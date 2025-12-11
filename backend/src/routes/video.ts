/**
 * Video Routes - Video streaming with Range request support and transcoding
 */

import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { getOne, getAll, run } from '../db.js';
import { srtToVtt, extractEmbeddedSubtitle } from '../services/subtitleConverter.js';
import { Media, SubtitleTrack } from '../types/db.js';

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

        const media = getOne<Media>(
            'SELECT * FROM media WHERE id = ?',
            [id]
        );

        if (!media) {
            return res.status(404).json({ error: 'Media not found' });
        }

        // Check if we have a converted version
        let filePath = media.file_path;
        let isConverted = false;

        if (media.converted_path && fs.existsSync(media.converted_path)) {
            filePath = media.converted_path;
            isConverted = true;
            console.log(`📦 Serving converted: ${media.file_name}`);
        }

        // Validate original path
        if (!isConverted && !validateFilePath(media.file_path)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Check file exists
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Check if file needs conversion (and isn't converted yet)
        const videoOk = ['h264', 'avc1', 'vp8', 'vp9'].some(c => media.video_codec?.toLowerCase().includes(c));
        const audioOk = ['aac', 'mp3', 'opus', 'vorbis', 'flac'].some(c => media.audio_codec?.toLowerCase().includes(c));
        const needsConversion = (!videoOk || !audioOk) && !isConverted;

        if (needsConversion) {
            console.log(`⚠️ Needs conversion: ${media.file_name} (${media.video_codec}/${media.audio_codec})`);

            return res.status(415).json({
                error: 'conversion_required',
                mediaId: id,
                videoCodec: media.video_codec,
                audioCodec: media.audio_codec,
                message: 'This file is being converted. Please wait...'
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
router.get('/:id/subtitle/:trackId', async (req, res) => {
    try {
        const mediaId = parseInt(req.params.id);
        const trackId = parseInt(req.params.trackId);

        const track = getOne<SubtitleTrack>(
            'SELECT * FROM subtitle_tracks WHERE id = ? AND media_id = ?',
            [trackId, mediaId]
        );

        if (!track) {
            return res.status(404).json({ error: 'Subtitle track not found' });
        }

        let subtitlePath = track.converted_path || track.external_path;

        if (track.is_embedded && !subtitlePath) {
            // Generate output path for extracted subtitle
            const media = getOne<Media>('SELECT file_path FROM media WHERE id = ?', [mediaId]);
            if (!media || !fs.existsSync(media.file_path)) {
                return res.status(404).json({ error: 'Source media file not found' });
            }

            if (track.track_index === null) {
                return res.status(400).json({ error: 'Invalid subtitle track index' });
            }

            // Define cache path for this track
            const cacheDir = path.join(process.cwd(), 'converted_cache');
            if (!fs.existsSync(cacheDir)) {
                fs.mkdirSync(cacheDir, { recursive: true });
            }

            const outputPath = path.join(cacheDir, `${mediaId}_${trackId}_${track.track_index}.vtt`);

            try {
                await extractEmbeddedSubtitle(media.file_path, track.track_index, outputPath);

                // Update DB to cache this result
                run('UPDATE subtitle_tracks SET converted_path = ? WHERE id = ?', [outputPath, trackId]);

                subtitlePath = outputPath;
                console.log(`✅ Extracted and cached subtitle: ${outputPath}`);
            } catch (error) {
                console.error('Failed to extract subtitle:', error);
                return res.status(500).json({ error: 'Subtitle extraction failed' });
            }
        }

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

        const media = getOne<Media>(
            `SELECT * FROM media WHERE id = ?`,
            [id]
        );

        if (!media) {
            return res.status(404).json({ error: 'Media not found' });
        }

        const willTranscode = needsTranscoding(media.video_codec || '', media.audio_codec || '');

        const subtitleTracks = getAll<SubtitleTrack>('SELECT * FROM subtitle_tracks WHERE media_id = ?', [id]);

        res.json({
            exists: fs.existsSync(media.file_path),
            size: fs.existsSync(media.file_path) ? fs.statSync(media.file_path).size : 0,
            videoCodec: media.video_codec,
            audioCodec: media.audio_codec,
            browserCompatible: media.browser_compatible === 1,
            willTranscode,
            duration: media.duration_seconds,
            streamUrl: `/api/video/${id}`,
            subtitleTracks
        });
    } catch (err) {
        console.error('Video info error:', err);
        res.status(500).json({ error: 'Failed to get video info' });
    }
});

export default router;
