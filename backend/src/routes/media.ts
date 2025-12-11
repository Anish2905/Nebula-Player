/**
 * Media Routes - CRUD operations for media library
 */

import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import db, { getAll, getOne, run } from '../db.js';
import { scanDirectory, scanAllPaths, cleanupMissingFiles } from '../scanner/fileScanner.js';
import { enrichAllMedia, enrichMedia } from '../services/tmdbService.js';
import { Media, SubtitleTrack, AudioTrack, PlaybackState } from '../types/db.js';

const router = Router();

// Helper: Get allowed library paths
function getAllowedPaths(): string[] {
    const paths = getAll<{ path: string }>('SELECT path FROM scan_paths WHERE enabled = 1');
    return paths.map(p => path.resolve(p.path));
}

// Helper: Filter media to only those in library paths
function filterMediaByLibraryPaths<T extends { file_path: string }>(media: T[]): T[] {
    const allowedPaths = getAllowedPaths();
    if (allowedPaths.length === 0) return []; // No paths configured, show nothing

    return media.filter(m => {
        const resolvedPath = path.resolve(m.file_path).toLowerCase();
        return allowedPaths.some(allowed => resolvedPath.startsWith(allowed.toLowerCase()));
    });
}

// GET /api/media - List all media with pagination and filters
router.get('/', (req, res) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = (page - 1) * limit;

        const type = req.query.type as string; // 'movie', 'tv', 'all'
        const sort = req.query.sort as string || 'added_at';
        const order = req.query.order as string || 'DESC';
        const search = req.query.search as string;
        const groupBySeries = req.query.group_by_series === 'true';
        const tmdbId = req.query.tmdb_id ? parseInt(req.query.tmdb_id as string) : undefined;

        let whereClause = '1=1';
        const params: unknown[] = [];

        if (type && type !== 'all') {
            whereClause += ' AND media_type = ?';
            params.push(type);
        }

        if (search) {
            whereClause += ' AND (title LIKE ? OR overview LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        if (tmdbId) {
            whereClause += ' AND tmdb_id = ?';
            params.push(tmdbId);
        }

        // Validate sort column
        const validSorts = ['title', 'year', 'added_at', 'rating', 'release_date'];
        const sortColumn = validSorts.includes(sort) ? sort : 'added_at';
        const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        // Grouping logic (Consolidated for both Count and Data queries)
        // Group by tmdb_id for TV shows, otherwise by ID
        const groupClause = groupBySeries
            ? "GROUP BY CASE WHEN media_type = 'tv' AND tmdb_id IS NOT NULL THEN tmdb_id ELSE id END"
            : "";

        // Get total count for pagination
        // When grouping, COUNT(*) counts rows in groups. We need to wrap in subquery or use DISTINCT kind of logic.
        // Simplest valid way for SQLite with better-sqlite3:
        let countSql: string;
        if (groupBySeries) {
            countSql = `SELECT COUNT(*) as count FROM (
                SELECT 1 FROM media 
                WHERE ${whereClause} 
                ${groupClause}
            ) as grouped`;
        } else {
            countSql = `SELECT COUNT(*) as count FROM media WHERE ${whereClause}`;
        }

        const countResult = getOne<{ count: number }>(countSql, params);
        const total = countResult?.count || 0;

        // Get paginated results
        // Note: We don't filter by library paths here for performance. 
        // We assume the DB only contains valid media from the scanner.
        // Get paginated results - REVERTED TO SIMPLE QUERY WITHOUT JOIN
        const paginatedMedia = getAll<Media>(
            `SELECT * FROM media 
            WHERE ${whereClause.replace(/m\./g, '')}
            ${groupClause.replace(/m\./g, '')}
            ORDER BY ${sortColumn.replace('m.', '')} ${sortOrder}
            LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        // Fetch playback state for these items
        if (paginatedMedia.length > 0) {
            const mediaIds = paginatedMedia.map(m => m.id).join(',');

            // Check if we have IDs (paranoia check)
            if (mediaIds.length > 0) {
                const states = getAll<PlaybackState>(
                    `SELECT media_id, position_seconds, duration_seconds, completed 
                     FROM playback_state 
                     WHERE media_id IN (${mediaIds})`
                );

                // Merge state into media objects
                const stateMap = new Map(states.map(s => [s.media_id, s]));

                (paginatedMedia as any[]).forEach(m => {
                    const s = stateMap.get(m.id);
                    if (s) {
                        m.progress_seconds = s.position_seconds;
                        m.state_total = s.duration_seconds;
                        m.completed = s.completed;
                    }
                });
            }
        }

        res.json({
            data: paginatedMedia,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (err) {
        console.error('Error fetching media:', err);
        res.status(500).json({ error: 'Failed to fetch media' });
    }
});

// GET /api/media/:id - Get single media details
router.get('/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);

        const media = getOne<Media>(
            `SELECT * FROM media WHERE id = ?`,
            [id]
        );

        if (!media) {
            return res.status(404).json({ error: 'Media not found' });
        }

        // Get subtitle tracks
        const subtitleTracks = getAll<SubtitleTrack>(
            `SELECT * FROM subtitle_tracks WHERE media_id = ?`,
            [id]
        );

        // Get audio tracks
        const audioTracks = getAll<AudioTrack>(
            `SELECT * FROM audio_tracks WHERE media_id = ?`,
            [id]
        );

        // Get playback state
        const playbackState = getOne<PlaybackState>(
            `SELECT * FROM playback_state WHERE media_id = ?`,
            [id]
        );

        res.json({
            ...media,
            subtitle_tracks: subtitleTracks,
            audio_tracks: audioTracks,
            playback_state: playbackState,
        });
    } catch (err) {
        console.error('Error fetching media details:', err);
        res.status(500).json({ error: 'Failed to fetch media details' });
    }
});

// POST /api/media/scan - Trigger library scan
router.post('/scan', async (req, res) => {
    try {
        const { path: scanPath, enrich = true } = req.body;

        let results;

        if (scanPath) {
            // Scan specific path
            results = [await scanDirectory(scanPath)];
        } else {
            // Scan all configured paths
            results = await scanAllPaths();
        }

        // Cleanup missing files
        const removed = cleanupMissingFiles();

        // Enrich with TMDB metadata
        let enriched = 0;
        if (enrich) {
            enriched = await enrichAllMedia(100);
        }

        res.json({
            success: true,
            results,
            removed,
            enriched,
        });
    } catch (err) {
        console.error('Scan error:', err);
        res.status(500).json({ error: 'Scan failed', message: (err as Error).message });
    }
});

// POST /api/media/:id/enrich - Manually trigger TMDB enrichment
router.post('/:id/enrich', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const success = await enrichMedia(id);

        if (success) {
            const media = getOne<unknown>('SELECT * FROM media WHERE id = ?', [id]);
            res.json({ success: true, media });
        } else {
            res.status(404).json({ error: 'No TMDB match found' });
        }
    } catch (err) {
        console.error('Enrich error:', err);
        res.status(500).json({ error: 'Enrichment failed' });
    }
});

// DELETE /api/media/:id - Remove media from library and disk
router.delete('/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);

        const media = getOne<{ id: number, file_path: string, converted_path: string | null }>('SELECT id, file_path, converted_path FROM media WHERE id = ?', [id]);

        if (!media) {
            return res.status(404).json({ error: 'Media not found' });
        }

        // Delete form disk
        try {
            if (media.file_path && fs.existsSync(media.file_path)) {
                fs.unlinkSync(media.file_path);
                console.log(`Deleted file: ${media.file_path}`);
            }
            if (media.converted_path && fs.existsSync(media.converted_path)) {
                fs.unlinkSync(media.converted_path);
                console.log(`Deleted converted file: ${media.converted_path}`);
            }
        } catch (fileErr) {
            console.error('Error removing file from disk:', fileErr);
            // Optionally continue to delete from DB or error out. 
            // Better to error out or warn? 
            // If we cant delete file, we probably shouldn't remove from DB if the user intent is "delete file".
            // But if the file is already gone, we should remove from DB.
            // Let's assume if it fails it might be permissions.
            return res.status(500).json({ error: 'Failed to delete file from disk', details: (fileErr as Error).message });
        }

        run('DELETE FROM media WHERE id = ?', [id]);

        res.json({ success: true, message: 'Media removed from library and disk' });
    } catch (err) {
        console.error('Delete error:', err);
        res.status(500).json({ error: 'Failed to delete media' });
    }
});

// GET /api/media/genres - Get all unique genres
router.get('/meta/genres', (req, res) => {
    try {
        const media = getAll<{ genres: string }>('SELECT DISTINCT genres FROM media WHERE genres IS NOT NULL');

        const allGenres = new Set<string>();
        for (const m of media) {
            try {
                const genres = JSON.parse(m.genres);
                genres.forEach((g: string) => allGenres.add(g));
            } catch { }
        }

        res.json({ genres: Array.from(allGenres).sort() });
    } catch (err) {
        console.error('Error fetching genres:', err);
        res.status(500).json({ error: 'Failed to fetch genres' });
    }
});

// GET /api/media/years - Get all unique years
router.get('/meta/years', (req, res) => {
    try {
        const years = getAll<{ year: number }>(
            'SELECT DISTINCT year FROM media WHERE year IS NOT NULL ORDER BY year DESC'
        );

        res.json({ years: years.map(y => y.year) });
    } catch (err) {
        console.error('Error fetching years:', err);
        res.status(500).json({ error: 'Failed to fetch years' });
    }
});

export default router;
