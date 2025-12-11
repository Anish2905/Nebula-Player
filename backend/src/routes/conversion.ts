/**
 * Conversion Routes - API for media conversion status and control
 */

import { Router } from 'express';
import {
    getConversionStatus,
    queueForConversion,
    queueAllIncompatible,
    cancelConversion,
    getCacheStats,
    hasConvertedVersion,
    conversionEvents
} from '../services/conversionService.js';
import { getAll } from '../db.js';

const router = Router();

// GET /api/conversion/status - Get conversion status for all jobs
router.get('/status', (req, res) => {
    const status = getConversionStatus();
    res.json(status);
});

// GET /api/conversion/incompatible - List all incompatible media
router.get('/incompatible', (req, res) => {
    const incompatible = getAll<{
        id: number;
        title: string;
        file_name: string;
        video_codec: string;
        audio_codec: string;
        converted_path: string | null;
    }>(
        `SELECT id, title, file_name, video_codec, audio_codec, converted_path FROM media 
         WHERE (audio_codec NOT IN ('aac', 'mp3', 'opus', 'vorbis', 'flac')
                OR video_codec NOT IN ('h264', 'avc1', 'vp8', 'vp9', 'av1'))
         AND audio_codec IS NOT NULL 
         AND audio_codec != 'unknown'`
    );

    const withStatus = incompatible.map(m => ({
        ...m,
        isConverted: !!m.converted_path,
        isQueued: false // Could check queue here
    }));

    res.json(withStatus);
});

// POST /api/conversion/queue/:id - Queue a single media for conversion
router.post('/queue/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const queued = queueForConversion(id);

    if (queued) {
        res.json({ success: true, message: `Media ${id} queued for conversion` });
    } else {
        res.json({ success: false, message: `Media ${id} already converted or queued` });
    }
});

// POST /api/conversion/queue-all - Queue all incompatible media
router.post('/queue-all', (req, res) => {
    const count = queueAllIncompatible();
    res.json({ success: true, queued: count });
});

// DELETE /api/conversion/:id - Cancel a conversion
router.delete('/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const cancelled = cancelConversion(id);
    res.json({ success: cancelled });
});

// GET /api/conversion/stats - Get cache statistics
router.get('/stats', (req, res) => {
    const stats = getCacheStats();
    res.json(stats);
});

// GET /api/conversion/events - Server-Sent Events for real-time updates
router.get('/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Send initial status
    const status = getConversionStatus();
    res.write(`data: ${JSON.stringify({ type: 'status', data: status })}\n\n`);

    // Event handlers
    const onProgress = (data: any) => {
        res.write(`data: ${JSON.stringify({ type: 'progress', data })}\n\n`);
    };

    const onStarted = (data: any) => {
        res.write(`data: ${JSON.stringify({ type: 'started', data })}\n\n`);
    };

    const onCompleted = (data: any) => {
        res.write(`data: ${JSON.stringify({ type: 'completed', data })}\n\n`);
    };

    const onFailed = (data: any) => {
        res.write(`data: ${JSON.stringify({ type: 'failed', data })}\n\n`);
    };

    const onQueued = (data: any) => {
        res.write(`data: ${JSON.stringify({ type: 'queued', data })}\n\n`);
    };

    // Subscribe to events
    conversionEvents.on('progress', onProgress);
    conversionEvents.on('started', onStarted);
    conversionEvents.on('completed', onCompleted);
    conversionEvents.on('failed', onFailed);
    conversionEvents.on('queued', onQueued);

    // Cleanup on disconnect
    req.on('close', () => {
        conversionEvents.off('progress', onProgress);
        conversionEvents.off('started', onStarted);
        conversionEvents.off('completed', onCompleted);
        conversionEvents.off('failed', onFailed);
        conversionEvents.off('queued', onQueued);
    });
});

export default router;
