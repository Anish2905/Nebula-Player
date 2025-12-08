/**
 * Media Routes - CRUD operations for media library
 */

import { Router } from 'express';
import path from 'path';
import db, { getAll, getOne, run } from '../db.js';
import { scanDirectory, scanAllPaths, cleanupMissingFiles } from '../scanner/fileScanner.js';
import { enrichAllMedia, enrichMedia } from '../services/tmdbService.js';

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

        const type = req.query.type as string;
        const sort = req.query.sort as string || 'added_at';
        const order = req.query.order as string || 'DESC';
        const search = req.query.search as string;

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

        // Validate sort column
        const validSorts = ['title', 'year', 'added_at', 'rating', 'release_date'];
        const sortColumn = validSorts.includes(sort) ? sort : 'added_at';
        const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        // Get all matching media (we'll filter and paginate after)
        const allMedia = getAll<{ file_path: string } & Record<string, unknown>>(
            `SELECT 
        id, file_path, file_name, title, year, media_type,
        season_number, episode_number, episode_title,
        tmdb_id, overview, poster_path, backdrop_path,
        genres, rating, vote_count, runtime,
        resolution, browser_compatible, has_subtitles,
        duration_seconds, added_at
      FROM media 
      WHERE ${whereClause}
      ORDER BY ${sortColumn} ${sortOrder}`,
            params
        );

        // Filter to only show media in library paths
        const filteredMedia = filterMediaByLibraryPaths(allMedia);
        const total = filteredMedia.length;

        // Manual pagination
        const offset = (page - 1) * limit;
        const paginatedMedia = filteredMedia.slice(offset, offset + limit);

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

        const media = getOne<unknown>(
            `SELECT * FROM media WHERE id = ?`,
            [id]
        );

        if (!media) {
            return res.status(404).json({ error: 'Media not found' });
        }

        // Get subtitle tracks
        const subtitleTracks = getAll<unknown>(
            `SELECT * FROM subtitle_tracks WHERE media_id = ?`,
            [id]
        );

        // Get audio tracks
        const audioTracks = getAll<unknown>(
            `SELECT * FROM audio_tracks WHERE media_id = ?`,
            [id]
        );

        // Get playback state
        const playbackState = getOne<unknown>(
            `SELECT * FROM playback_state WHERE media_id = ?`,
            [id]
        );

        res.json({
            ...media as object,
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

// DELETE /api/media/:id - Remove media from library
router.delete('/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);

        const media = getOne<{ id: number }>('SELECT id FROM media WHERE id = ?', [id]);

        if (!media) {
            return res.status(404).json({ error: 'Media not found' });
        }

        run('DELETE FROM media WHERE id = ?', [id]);

        res.json({ success: true, message: 'Media removed from library' });
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
