/**
 * Transcoder Service - Background transcoding for incompatible media files
 * Pre-converts files to browser-compatible format for seamless playback
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { getOne, getAll, run } from '../db.js';

// Cache directory for transcoded files
const CACHE_DIR = path.join(process.cwd(), 'transcoded_cache');

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Active transcoding jobs
const activeJobs = new Map<number, { process: ReturnType<typeof spawn>; progress: number }>();

// Queue for pending jobs
const pendingQueue: number[] = [];
const MAX_CONCURRENT_JOBS = 1; // Limit concurrent transcodes

/**
 * Get the cached file path for a media item
 */
export function getCachedPath(mediaId: number): string {
    return path.join(CACHE_DIR, `${mediaId}.mp4`);
}

/**
 * Check if a transcoded version exists
 */
export function hasTranscodedVersion(mediaId: number): boolean {
    const cachedPath = getCachedPath(mediaId);
    return fs.existsSync(cachedPath);
}

/**
 * Get transcoding status for a media item
 */
export function getTranscodeStatus(mediaId: number): {
    status: 'none' | 'pending' | 'transcoding' | 'complete';
    progress?: number;
    cachedPath?: string;
} {
    if (hasTranscodedVersion(mediaId)) {
        return { status: 'complete', cachedPath: getCachedPath(mediaId) };
    }
    if (activeJobs.has(mediaId)) {
        return { status: 'transcoding', progress: activeJobs.get(mediaId)?.progress || 0 };
    }
    if (pendingQueue.includes(mediaId)) {
        return { status: 'pending' };
    }
    return { status: 'none' };
}

/**
 * Queue a media item for transcoding
 */
export function queueTranscode(mediaId: number): void {
    if (hasTranscodedVersion(mediaId)) {
        console.log(`✅ Media ${mediaId} already transcoded`);
        return;
    }
    if (activeJobs.has(mediaId) || pendingQueue.includes(mediaId)) {
        console.log(`⏳ Media ${mediaId} already queued`);
        return;
    }

    pendingQueue.push(mediaId);
    console.log(`📝 Added media ${mediaId} to transcode queue`);
    processQueue();
}

/**
 * Process the transcode queue
 */
function processQueue(): void {
    if (activeJobs.size >= MAX_CONCURRENT_JOBS) {
        return;
    }

    const mediaId = pendingQueue.shift();
    if (!mediaId) return;

    startTranscode(mediaId);
}

/**
 * Start transcoding a media item
 */
async function startTranscode(mediaId: number): Promise<void> {
    const media = getOne<{
        file_path: string;
        file_name: string;
        duration_seconds: number;
    }>('SELECT file_path, file_name, duration_seconds FROM media WHERE id = ?', [mediaId]);

    if (!media) {
        console.error(`❌ Media ${mediaId} not found`);
        processQueue();
        return;
    }

    if (!fs.existsSync(media.file_path)) {
        console.error(`❌ File not found: ${media.file_path}`);
        processQueue();
        return;
    }

    const outputPath = getCachedPath(mediaId);
    const tempPath = outputPath + '.tmp';

    console.log(`🎬 Starting transcode: ${media.file_name}`);

    const ffmpegArgs = [
        '-i', media.file_path,
        '-map', '0:v:0',
        '-map', '0:a:0',
        '-c:v', 'copy',              // Copy video (already H.264)
        '-c:a', 'aac',               // Convert audio to AAC
        '-ac', '2',
        '-b:a', '192k',
        '-movflags', '+faststart',   // Enable seeking
        '-y',                        // Overwrite
        tempPath
    ];

    const ffmpeg = spawn('ffmpeg', ffmpegArgs);

    activeJobs.set(mediaId, { process: ffmpeg, progress: 0 });

    let duration = media.duration_seconds || 0;

    ffmpeg.stderr.on('data', (data) => {
        const output = data.toString();

        // Parse duration if not known
        if (!duration) {
            const durationMatch = output.match(/Duration: (\d+):(\d+):(\d+)/);
            if (durationMatch) {
                duration = parseInt(durationMatch[1]) * 3600 +
                    parseInt(durationMatch[2]) * 60 +
                    parseInt(durationMatch[3]);
            }
        }

        // Parse progress
        const timeMatch = output.match(/time=(\d+):(\d+):(\d+)/);
        if (timeMatch && duration > 0) {
            const currentTime = parseInt(timeMatch[1]) * 3600 +
                parseInt(timeMatch[2]) * 60 +
                parseInt(timeMatch[3]);
            const progress = Math.min(100, Math.round((currentTime / duration) * 100));

            const job = activeJobs.get(mediaId);
            if (job) {
                job.progress = progress;
            }
        }
    });

    ffmpeg.on('close', (code) => {
        activeJobs.delete(mediaId);

        if (code === 0 && fs.existsSync(tempPath)) {
            // Rename temp file to final
            fs.renameSync(tempPath, outputPath);
            console.log(`✅ Transcode complete: ${media.file_name}`);

            // Update database
            run('UPDATE media SET transcoded_path = ? WHERE id = ?', [outputPath, mediaId]);
        } else {
            console.error(`❌ Transcode failed: ${media.file_name} (code ${code})`);
            // Clean up temp file
            if (fs.existsSync(tempPath)) {
                fs.unlinkSync(tempPath);
            }
        }

        // Process next in queue
        processQueue();
    });

    ffmpeg.on('error', (err) => {
        console.error(`❌ FFmpeg error:`, err);
        activeJobs.delete(mediaId);
        processQueue();
    });
}

/**
 * Cancel a transcoding job
 */
export function cancelTranscode(mediaId: number): void {
    const job = activeJobs.get(mediaId);
    if (job) {
        job.process.kill();
        activeJobs.delete(mediaId);
        console.log(`🛑 Cancelled transcode: ${mediaId}`);
    }

    const queueIndex = pendingQueue.indexOf(mediaId);
    if (queueIndex > -1) {
        pendingQueue.splice(queueIndex, 1);
    }
}

/**
 * Delete cached transcode
 */
export function deleteTranscode(mediaId: number): void {
    const cachedPath = getCachedPath(mediaId);
    if (fs.existsSync(cachedPath)) {
        fs.unlinkSync(cachedPath);
        run('UPDATE media SET transcoded_path = NULL WHERE id = ?', [mediaId]);
        console.log(`🗑️ Deleted transcode cache: ${mediaId}`);
    }
}

/**
 * Queue all incompatible media for transcoding
 */
export function queueAllIncompatible(): void {
    const incompatibleMedia = getAll<{ id: number; file_name: string }>(
        `SELECT id, file_name FROM media 
         WHERE (audio_codec NOT IN ('aac', 'mp3', 'opus', 'vorbis', 'flac') 
                OR video_codec NOT IN ('h264', 'avc1', 'vp8', 'vp9'))
         AND transcoded_path IS NULL`
    );

    console.log(`📋 Found ${incompatibleMedia.length} files needing transcoding`);

    for (const media of incompatibleMedia) {
        queueTranscode(media.id);
    }
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
    totalFiles: number;
    totalSize: number;
    activeJobs: number;
    pendingJobs: number;
} {
    let totalSize = 0;
    let totalFiles = 0;

    if (fs.existsSync(CACHE_DIR)) {
        const files = fs.readdirSync(CACHE_DIR);
        totalFiles = files.filter(f => f.endsWith('.mp4')).length;

        for (const file of files) {
            if (file.endsWith('.mp4')) {
                const stat = fs.statSync(path.join(CACHE_DIR, file));
                totalSize += stat.size;
            }
        }
    }

    return {
        totalFiles,
        totalSize,
        activeJobs: activeJobs.size,
        pendingJobs: pendingQueue.length
    };
}
