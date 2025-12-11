/**
 * Transcode Routes - Manage background transcoding jobs
 */

import { Router } from 'express';
import {
    queueTranscode,
    queueAllIncompatible,
    getTranscodeStatus,
    cancelTranscode,
    deleteTranscode,
    getCacheStats,
    hasTranscodedVersion
} from '../services/transcoderService.js';
import { getAll, getOne } from '../db.js';

const router = Router();

// GET /api/transcode/status/:id - Get transcode status for a media item
router.get('/status/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const status = getTranscodeStatus(id);
    res.json(status);
});

// POST /api/transcode/queue/:id - Queue a media item for transcoding
router.post('/queue/:id', (req, res) => {
    const id = parseInt(req.params.id);
    queueTranscode(id);
    res.json({ success: true, message: `Media ${id} queued for transcoding` });
});

// POST /api/transcode/queue-all - Queue all incompatible media
router.post('/queue-all', (req, res) => {
    queueAllIncompatible();
    res.json({ success: true, message: 'Queued all incompatible media for transcoding' });
});

// DELETE /api/transcode/:id - Cancel or delete transcode
router.delete('/:id', (req, res) => {
    const id = parseInt(req.params.id);
    cancelTranscode(id);
    deleteTranscode(id);
    res.json({ success: true, message: `Transcode ${id} cancelled/deleted` });
});

// GET /api/transcode/stats - Get cache statistics
router.get('/stats', (req, res) => {
    const stats = getCacheStats();
    res.json(stats);
});

// GET /api/transcode/incompatible - List all media needing transcoding
router.get('/incompatible', (req, res) => {
    const incompatible = getAll<{
        id: number;
        title: string;
        file_name: string;
        video_codec: string;
        audio_codec: string;
    }>(
        `SELECT id, title, file_name, video_codec, audio_codec FROM media 
         WHERE (audio_codec NOT IN ('aac', 'mp3', 'opus', 'vorbis', 'flac') 
                OR video_codec NOT IN ('h264', 'avc1', 'vp8', 'vp9'))
         AND (audio_codec IS NOT NULL AND audio_codec != 'unknown')
         AND transcoded_path IS NULL`
    );

    const withStatus = incompatible.map(m => ({
        ...m,
        ...getTranscodeStatus(m.id)
    }));

    res.json(withStatus);
});

export default router;
