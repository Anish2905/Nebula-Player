/**
 * Video Routes - Video streaming with Range request support and transcoding
 */

import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { getOne, getAll } from '../db.js';
import { srtToVtt } from '../services/subtitleConverter.js';

const router = Router();

// Allowed base paths for security (populated from scan_paths)
function getAllowedPaths(): string[] {
    const paths = getAll<{ path: string }>('SELECT path FROM scan_paths');
    return paths.map(p => path.resolve(p.path));
}

// Validate file path is within allowed directories
function validateFilePath(filePath: string): boolean {
    const resolved = path.resolve(filePath);
    const allowedPaths = getAllowedPaths();

    // Also allow the file if it's in the database
    const exists = getOne<{ id: number }>('SELECT id FROM media WHERE file_path = ?', [resolved]);
    if (exists) return true;

    return allowedPaths.some(allowed => resolved.startsWith(allowed));
}

// Check if codec needs transcoding
function needsTranscoding(videoCodec: string, audioCodec: string): boolean {
    // If codec is unknown or empty, try direct playback first
    if (!videoCodec || videoCodec === 'unknown' || !audioCodec || audioCodec === 'unknown') {
        return false;
    }

    const compatibleVideo = ['h264', 'avc1', 'vp8', 'vp9', 'av1'];
    const compatibleAudio = ['aac', 'mp3', 'opus', 'vorbis', 'flac'];

    const videoOk = compatibleVideo.some(c => videoCodec?.toLowerCase().includes(c));
    const audioOk = compatibleAudio.some(c => audioCodec?.toLowerCase().includes(c));

    return !videoOk || !audioOk;
}

// GET /api/video/:id - Stream video file (with optional transcoding)
router.get('/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);

        const media = getOne<{
            file_path: string;
            file_name: string;
            video_codec: string;
            audio_codec: string;
            browser_compatible: number;
        }>(
            'SELECT file_path, file_name, video_codec, audio_codec, browser_compatible FROM media WHERE id = ?',
            [id]
        );

        if (!media) {
            return res.status(404).json({ error: 'Media not found' });
        }

        const filePath = media.file_path;

        // Validate path
        if (!validateFilePath(filePath)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Check file exists
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Check if transcoding is needed
        const shouldTranscode = needsTranscoding(media.video_codec || '', media.audio_codec || '');

        if (shouldTranscode) {
            // Transcode on-the-fly using FFmpeg
            console.log(`🔄 Transcoding ${media.file_name} (${media.video_codec}/${media.audio_codec})`);

            res.setHeader('Content-Type', 'video/mp4');
            res.setHeader('Cache-Control', 'no-cache');

            const ffmpeg = spawn('ffmpeg', [
                '-i', filePath,
                '-vf', 'format=yuv420p',      // Convert any pixel format to yuv420p
                '-c:v', 'libx264',
                '-profile:v', 'main',         // Main profile for better quality
                '-level', '4.0',
                '-preset', 'veryfast',         // Balance speed and quality
                '-crf', '23',                  // Better quality
                '-c:a', 'aac',
                '-ac', '2',
                '-b:a', '192k',
                '-movflags', 'frag_keyframe+empty_moov+faststart',
                '-f', 'mp4',
                '-'
            ]);

            ffmpeg.stdout.pipe(res);

            ffmpeg.stderr.on('data', (data) => {
                // Log FFmpeg progress (optional, can be noisy)
                const msg = data.toString();
                if (msg.includes('Error') || msg.includes('error')) {
                    console.error('FFmpeg error:', msg);
                }
            });

            ffmpeg.on('error', (err) => {
                console.error('FFmpeg spawn error:', err);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Transcoding failed to start' });
                }
            });

            ffmpeg.on('close', (code) => {
                if (code !== 0 && code !== null) {
                    console.log(`FFmpeg exited with code ${code}`);
                }
            });

            // Handle client disconnect
            req.on('close', () => {
                ffmpeg.kill('SIGTERM');
            });

        } else {
            // Direct streaming (no transcoding needed)
            const stat = fs.statSync(filePath);
            const fileSize = stat.size;
            const range = req.headers.range;

            const contentType = 'video/mp4';

            if (range) {
                // Parse Range header
                const parts = range.replace(/bytes=/, '').split('-');
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

                // Validate range
                if (start >= fileSize || end >= fileSize) {
                    res.status(416).json({ error: 'Requested range not satisfiable' });
                    return;
                }

                const chunkSize = (end - start) + 1;
                const file = fs.createReadStream(filePath, { start, end });

                res.writeHead(206, {
                    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunkSize,
                    'Content-Type': contentType,
                });

                file.pipe(res);
            } else {
                res.writeHead(200, {
                    'Content-Length': fileSize,
                    'Content-Type': contentType,
                    'Accept-Ranges': 'bytes',
                });

                fs.createReadStream(filePath).pipe(res);
            }
        }
    } catch (err) {
        console.error('Video streaming error:', err);
        res.status(500).json({ error: 'Streaming failed' });
    }
});

// GET /api/video/:id/subtitle/:trackId - Get subtitle track as WebVTT
router.get('/:id/subtitle/:trackId', (req, res) => {
    try {
        const mediaId = parseInt(req.params.id);
        const trackId = parseInt(req.params.trackId);

        const track = getOne<{
            media_id: number;
            is_embedded: number;
            external_path: string;
            converted_path: string;
        }>(
            'SELECT * FROM subtitle_tracks WHERE id = ? AND media_id = ?',
            [trackId, mediaId]
        );

        if (!track) {
            return res.status(404).json({ error: 'Subtitle track not found' });
        }

        if (track.is_embedded && !track.converted_path) {
            return res.status(501).json({
                error: 'Embedded subtitle extraction not implemented.'
            });
        }

        const subtitlePath = track.converted_path || track.external_path;

        if (!subtitlePath || !fs.existsSync(subtitlePath)) {
            return res.status(404).json({ error: 'Subtitle file not found' });
        }

        const content = fs.readFileSync(subtitlePath, 'utf-8');
        const ext = path.extname(subtitlePath).toLowerCase();

        if (ext === '.srt') {
            const vtt = srtToVtt(content);
            res.setHeader('Content-Type', 'text/vtt');
            res.send(vtt);
        } else if (ext === '.vtt') {
            res.setHeader('Content-Type', 'text/vtt');
            res.send(content);
        } else {
            res.status(400).json({ error: 'Unsupported subtitle format' });
        }
    } catch (err) {
        console.error('Subtitle error:', err);
        res.status(500).json({ error: 'Failed to get subtitle' });
    }
});

// GET /api/video/:id/info - Get video stream info
router.get('/:id/info', (req, res) => {
    try {
        const id = parseInt(req.params.id);

        const media = getOne<{
            file_path: string;
            file_size: number;
            video_codec: string;
            audio_codec: string;
            browser_compatible: number;
            duration_seconds: number;
        }>(
            `SELECT file_path, file_size, video_codec, audio_codec, browser_compatible, duration_seconds 
       FROM media WHERE id = ?`,
            [id]
        );

        if (!media) {
            return res.status(404).json({ error: 'Media not found' });
        }

        const willTranscode = needsTranscoding(media.video_codec || '', media.audio_codec || '');

        res.json({
            exists: fs.existsSync(media.file_path),
            size: media.file_size,
            videoCodec: media.video_codec,
            audioCodec: media.audio_codec,
            browserCompatible: media.browser_compatible === 1,
            willTranscode,
            duration: media.duration_seconds,
            streamUrl: `/api/video/${id}`,
        });
    } catch (err) {
        console.error('Video info error:', err);
        res.status(500).json({ error: 'Failed to get video info' });
    }
});

export default router;
