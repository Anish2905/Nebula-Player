/**
 * Settings Routes - Application configuration
 */

import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { getAll, getOne, run, insert } from '../db.js';

const router = Router();

// GET /api/settings - Get all settings
router.get('/', (req, res) => {
    try {
        const settings = getAll<{ key: string; value: string; type: string }>(
            'SELECT key, value, type FROM settings'
        );

        // Convert to object with proper types
        const settingsObj: Record<string, unknown> = {};

        for (const s of settings) {
            let value: unknown = s.value;

            switch (s.type) {
                case 'number':
                    value = parseFloat(s.value);
                    break;
                case 'boolean':
                    value = s.value === 'true';
                    break;
                case 'json':
                    try {
                        value = JSON.parse(s.value);
                    } catch { }
                    break;
            }

            settingsObj[s.key] = value;
        }

        res.json(settingsObj);
    } catch (err) {
        console.error('Error fetching settings:', err);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

// PUT /api/settings - Update settings
router.put('/', (req, res) => {
    try {
        const updates = req.body;

        for (const [key, value] of Object.entries(updates)) {
            let strValue: string;
            let type: string;

            if (typeof value === 'boolean') {
                strValue = value.toString();
                type = 'boolean';
            } else if (typeof value === 'number') {
                strValue = value.toString();
                type = 'number';
            } else if (typeof value === 'object') {
                strValue = JSON.stringify(value);
                type = 'json';
            } else {
                strValue = String(value);
                type = 'string';
            }

            run(`
        INSERT INTO settings (key, value, type, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET
          value = ?,
          type = ?,
          updated_at = CURRENT_TIMESTAMP
      `, [key, strValue, type, strValue, type]);
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Error updating settings:', err);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

// GET /api/settings/scan-paths - Get all scan paths
router.get('/scan-paths', (req, res) => {
    try {
        const paths = getAll<{
            id: number;
            path: string;
            enabled: number;
            recursive: number;
            last_scan_at: string;
            files_found: number;
        }>('SELECT * FROM scan_paths ORDER BY added_at DESC');

        // Check if paths exist on filesystem
        const pathsWithStatus = paths.map(p => ({
            ...p,
            enabled: p.enabled === 1,
            recursive: p.recursive === 1,
            exists: fs.existsSync(p.path),
        }));

        res.json({ data: pathsWithStatus });
    } catch (err) {
        console.error('Error fetching scan paths:', err);
        res.status(500).json({ error: 'Failed to fetch scan paths' });
    }
});

// POST /api/settings/scan-paths - Add a scan path
router.post('/scan-paths', (req, res) => {
    try {
        const { path: scanPath, recursive = true } = req.body;

        if (!scanPath) {
            return res.status(400).json({ error: 'path is required' });
        }

        // Validate path exists
        const resolvedPath = path.resolve(scanPath);

        if (!fs.existsSync(resolvedPath)) {
            return res.status(400).json({ error: 'Path does not exist' });
        }

        if (!fs.statSync(resolvedPath).isDirectory()) {
            return res.status(400).json({ error: 'Path is not a directory' });
        }

        // Check if already exists
        const existing = getOne<{ id: number }>(
            'SELECT id FROM scan_paths WHERE path = ?',
            [resolvedPath]
        );

        if (existing) {
            return res.status(409).json({ error: 'Path already exists' });
        }

        // Insert new path
        const id = insert(
            'INSERT INTO scan_paths (path, recursive) VALUES (?, ?)',
            [resolvedPath, recursive ? 1 : 0]
        );

        res.status(201).json({
            success: true,
            id: Number(id),
            path: resolvedPath,
            recursive,
        });
    } catch (err) {
        console.error('Error adding scan path:', err);
        res.status(500).json({ error: 'Failed to add scan path' });
    }
});

// PUT /api/settings/scan-paths/:id - Update a scan path
router.put('/scan-paths/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { enabled, recursive } = req.body;

        const existing = getOne<{ id: number }>('SELECT id FROM scan_paths WHERE id = ?', [id]);

        if (!existing) {
            return res.status(404).json({ error: 'Scan path not found' });
        }

        const updates: string[] = [];
        const params: unknown[] = [];

        if (typeof enabled === 'boolean') {
            updates.push('enabled = ?');
            params.push(enabled ? 1 : 0);
        }

        if (typeof recursive === 'boolean') {
            updates.push('recursive = ?');
            params.push(recursive ? 1 : 0);
        }

        if (updates.length > 0) {
            params.push(id);
            run(`UPDATE scan_paths SET ${updates.join(', ')} WHERE id = ?`, params);
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Error updating scan path:', err);
        res.status(500).json({ error: 'Failed to update scan path' });
    }
});

// DELETE /api/settings/scan-paths/:id - Remove a scan path
router.delete('/scan-paths/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);

        const existing = getOne<{ id: number }>('SELECT id FROM scan_paths WHERE id = ?', [id]);

        if (!existing) {
            return res.status(404).json({ error: 'Scan path not found' });
        }

        run('DELETE FROM scan_paths WHERE id = ?', [id]);

        res.json({ success: true, message: 'Scan path removed' });
    } catch (err) {
        console.error('Error deleting scan path:', err);
        res.status(500).json({ error: 'Failed to delete scan path' });
    }
});

// POST /api/settings/clear-history - Clear watch history
router.post('/clear-history', (req, res) => {
    try {
        run('DELETE FROM playback_state');
        res.json({ success: true, message: 'Watch history cleared' });
    } catch (err) {
        console.error('Error clearing history:', err);
        res.status(500).json({ error: 'Failed to clear history' });
    }
});

// POST /api/settings/clear-tmdb-cache - Clear TMDB cache
router.post('/clear-tmdb-cache', (req, res) => {
    try {
        run('DELETE FROM tmdb_cache');
        // Reset TMDB data on media
        run(`
      UPDATE media SET
        tmdb_id = NULL,
        tmdb_type = NULL,
        overview = NULL,
        poster_path = NULL,
        backdrop_path = NULL,
        genres = NULL,
        cast_members = NULL,
        director = NULL,
        rating = NULL,
        vote_count = NULL,
        match_confidence = 0,
        match_method = 'auto',
        tmdb_fetched_at = NULL
    `);
        res.json({ success: true, message: 'TMDB cache cleared' });
    } catch (err) {
        console.error('Error clearing TMDB cache:', err);
        res.status(500).json({ error: 'Failed to clear TMDB cache' });
    }
});

// GET /api/settings/scan-errors - Get recent scan errors
router.get('/scan-errors', (req, res) => {
    try {
        const limit = parseInt(req.query.limit as string) || 50;

        const errors = getAll<unknown>(
            `SELECT * FROM scan_errors 
       WHERE resolved = 0 
       ORDER BY occurred_at DESC 
       LIMIT ?`,
            [limit]
        );

        res.json({ data: errors });
    } catch (err) {
        console.error('Error fetching scan errors:', err);
        res.status(500).json({ error: 'Failed to fetch scan errors' });
    }
});

// DELETE /api/settings/scan-errors/:id - Clear a scan error
router.delete('/scan-errors/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        run('UPDATE scan_errors SET resolved = 1 WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Error clearing scan error:', err);
        res.status(500).json({ error: 'Failed to clear scan error' });
    }
});

export default router;
