/**
 * Playback Routes - Track and manage playback state
 */

import { Router } from 'express';
import path from 'path';
import { getOne, getAll, run, insert } from '../db.js';

const router = Router();

interface PlaybackState {
    media_id: number;
    position_seconds: number;
    duration_seconds: number;
    progress_percent: number;
    completed: number;
    last_watched_at: string;
    watch_count: number;
}

// Helper: Get allowed library paths
function getAllowedPaths(): string[] {
    const paths = getAll<{ path: string }>('SELECT path FROM scan_paths WHERE enabled = 1');
    return paths.map(p => path.resolve(p.path));
}

// Helper: Filter media to only those in library paths
function filterByLibraryPaths<T extends { file_path?: string }>(items: T[]): T[] {
    const allowedPaths = getAllowedPaths();
    if (allowedPaths.length === 0) return []; // No paths = show nothing

    return items.filter(item => {
        if (!item.file_path) return false;
        const resolvedPath = path.resolve(item.file_path).toLowerCase();
        return allowedPaths.some(allowed => resolvedPath.startsWith(allowed.toLowerCase()));
    });
}

// GET /api/playback/continue - Get continue watching list
router.get('/continue', (req, res) => {
    try {
        const limit = parseInt(req.query.limit as string) || 20;

        const continueWatching = getAll<{ file_path: string } & Record<string, unknown>>(`
      SELECT 
        m.id, m.file_path, m.title, m.year, m.media_type, m.poster_path, m.backdrop_path,
        m.season_number, m.episode_number, m.episode_title, m.duration_seconds,
        p.position_seconds, p.progress_percent, p.last_watched_at
      FROM playback_state p
      JOIN media m ON m.id = p.media_id
      WHERE p.completed = 0 AND p.progress_percent > 1 AND p.progress_percent < 95
      ORDER BY p.last_watched_at DESC
    `, []);

        // Filter to only media in library paths
        const filtered = filterByLibraryPaths(continueWatching).slice(0, limit);

        res.json({ data: filtered });
    } catch (err) {
        console.error('Error fetching continue watching:', err);
        res.status(500).json({ error: 'Failed to fetch continue watching' });
    }
});

// GET /api/playback/recently-watched - Get recently watched
router.get('/recently-watched', (req, res) => {
    try {
        const limit = parseInt(req.query.limit as string) || 20;

        const recentlyWatched = getAll<{ file_path: string } & Record<string, unknown>>(`
      SELECT 
        m.id, m.file_path, m.title, m.year, m.media_type, m.poster_path, m.backdrop_path,
        m.season_number, m.episode_number, m.episode_title,
        p.position_seconds, p.progress_percent, p.completed, p.last_watched_at, p.watch_count
      FROM playback_state p
      JOIN media m ON m.id = p.media_id
      ORDER BY p.last_watched_at DESC
    `, []);

        // Filter to only media in library paths
        const filtered = filterByLibraryPaths(recentlyWatched).slice(0, limit);

        res.json({ data: filtered });
    } catch (err) {
        console.error('Error fetching recently watched:', err);
        res.status(500).json({ error: 'Failed to fetch recently watched' });
    }
});

// GET /api/playback/:id - Get playback state for a media item
router.get('/:id', (req, res) => {
    try {
        const mediaId = parseInt(req.params.id);

        const state = getOne<PlaybackState>(
            'SELECT * FROM playback_state WHERE media_id = ?',
            [mediaId]
        );

        if (state) {
            res.json(state);
        } else {
            res.json({
                media_id: mediaId,
                position_seconds: 0,
                duration_seconds: 0,
                progress_percent: 0,
                completed: false,
                last_watched_at: null,
                watch_count: 0,
            });
        }
    } catch (err) {
        console.error('Error fetching playback state:', err);
        res.status(500).json({ error: 'Failed to fetch playback state' });
    }
});

// POST /api/playback/:id - Save playback position
router.post('/:id', (req, res) => {
    try {
        const mediaId = parseInt(req.params.id);
        const { position_seconds, duration_seconds } = req.body;

        if (typeof position_seconds !== 'number' || typeof duration_seconds !== 'number') {
            return res.status(400).json({ error: 'position_seconds and duration_seconds are required' });
        }

        const progress_percent = duration_seconds > 0
            ? Math.round((position_seconds / duration_seconds) * 10000) / 100
            : 0;

        // Mark as completed if >90% watched
        const completed = progress_percent >= 90 ? 1 : 0;

        // Check if state exists
        const existing = getOne<{ media_id: number; watch_count: number }>(
            'SELECT media_id, watch_count FROM playback_state WHERE media_id = ?',
            [mediaId]
        );

        if (existing) {
            run(`
        UPDATE playback_state SET
          position_seconds = ?,
          duration_seconds = ?,
          progress_percent = ?,
          completed = ?,
          last_watched_at = CURRENT_TIMESTAMP
        WHERE media_id = ?
      `, [position_seconds, duration_seconds, progress_percent, completed, mediaId]);
        } else {
            insert(`
        INSERT INTO playback_state (media_id, position_seconds, duration_seconds, progress_percent, completed)
        VALUES (?, ?, ?, ?, ?)
      `, [mediaId, position_seconds, duration_seconds, progress_percent, completed]);
        }

        res.json({
            success: true,
            position_seconds,
            progress_percent,
            completed: completed === 1,
        });
    } catch (err) {
        console.error('Error saving playback state:', err);
        res.status(500).json({ error: 'Failed to save playback state' });
    }
});

// PUT /api/playback/:id/watched - Mark as watched/unwatched
router.put('/:id/watched', (req, res) => {
    try {
        const mediaId = parseInt(req.params.id);
        const { watched } = req.body;

        if (typeof watched !== 'boolean') {
            return res.status(400).json({ error: 'watched boolean is required' });
        }

        const existing = getOne<{ media_id: number; watch_count: number; duration_seconds: number }>(
            'SELECT media_id, watch_count, duration_seconds FROM playback_state WHERE media_id = ?',
            [mediaId]
        );

        if (existing) {
            const newWatchCount = watched ? existing.watch_count + 1 : existing.watch_count;
            run(`
        UPDATE playback_state SET
          completed = ?,
          watch_count = ?,
          position_seconds = ?,
          progress_percent = ?,
          last_watched_at = CURRENT_TIMESTAMP
        WHERE media_id = ?
      `, [
                watched ? 1 : 0,
                newWatchCount,
                watched ? existing.duration_seconds : 0,
                watched ? 100 : 0,
                mediaId
            ]);
        } else if (watched) {
            // Get duration from media
            const media = getOne<{ duration_seconds: number }>(
                'SELECT duration_seconds FROM media WHERE id = ?',
                [mediaId]
            );
            const duration = media?.duration_seconds || 0;

            insert(`
        INSERT INTO playback_state (media_id, position_seconds, duration_seconds, progress_percent, completed, watch_count)
        VALUES (?, ?, ?, 100, 1, 1)
      `, [mediaId, duration, duration]);
        }

        res.json({ success: true, watched });
    } catch (err) {
        console.error('Error updating watched status:', err);
        res.status(500).json({ error: 'Failed to update watched status' });
    }
});

// DELETE /api/playback/:id - Clear playback state
router.delete('/:id', (req, res) => {
    try {
        const mediaId = parseInt(req.params.id);

        run('DELETE FROM playback_state WHERE media_id = ?', [mediaId]);

        res.json({ success: true, message: 'Playback state cleared' });
    } catch (err) {
        console.error('Error clearing playback state:', err);
        res.status(500).json({ error: 'Failed to clear playback state' });
    }
});

export default router;
