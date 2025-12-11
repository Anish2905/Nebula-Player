/**
 * Conversion Service - Background media conversion with progress tracking
 * Converts incompatible audio codecs (EAC3, AC3, DTS) to AAC
 */

import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import { getOne, getAll, run } from '../db.js';
import { EventEmitter } from 'events';

// Cache directory for converted files
const CACHE_DIR = path.join(process.cwd(), 'converted_cache');

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Event emitter for progress updates
export const conversionEvents = new EventEmitter();

// Types
interface ConversionJob {
    mediaId: number;
    fileName: string;
    filePath: string;
    outputPath: string;
    status: 'queued' | 'converting' | 'completed' | 'failed';
    progress: number;
    error?: string;
    startTime?: number;
    endTime?: number;
    command?: ffmpeg.FfmpegCommand;
}

// Active jobs and queue
const activeJobs = new Map<number, ConversionJob>();
const jobQueue: number[] = [];
const MAX_CONCURRENT = 1;
let isProcessing = false;

/**
 * Get conversion status for all jobs
 */
export function getConversionStatus(): {
    active: Omit<ConversionJob, 'command'>[];
    queued: number[];
    completed: number;
    totalInQueue: number;
} {
    const active: Omit<ConversionJob, 'command'>[] = [];
    activeJobs.forEach((job, id) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { command, ...jobData } = job;
        active.push(jobData);
    });

    // Count completed conversions
    const completedCount = getAll<{ id: number }>(
        `SELECT id FROM media WHERE converted_path IS NOT NULL`
    ).length;

    return {
        active,
        queued: [...jobQueue],
        completed: completedCount,
        totalInQueue: jobQueue.length + activeJobs.size
    };
}

/**
 * Get converted file path for a media item
 */
export function getConvertedPath(mediaId: number): string {
    return path.join(CACHE_DIR, `${mediaId}.mp4`);
}

/**
 * Check if a media item has been converted
 */
export function hasConvertedVersion(mediaId: number): boolean {
    const media = getOne<{ converted_path: string | null }>(
        'SELECT converted_path FROM media WHERE id = ?',
        [mediaId]
    );
    return !!(media?.converted_path && fs.existsSync(media.converted_path));
}

/**
 * Queue a media item for conversion
 */
export function queueForConversion(mediaId: number): boolean {
    // Check if already converted
    if (hasConvertedVersion(mediaId)) {
        return false;
    }

    // Check if already queued or processing
    if (activeJobs.has(mediaId) || jobQueue.includes(mediaId)) {
        return false;
    }

    jobQueue.push(mediaId);
    console.log(`📝 Queued for conversion: media ${mediaId}`);

    // Emit event
    conversionEvents.emit('queued', { mediaId });

    // Start processing if not already
    processQueue();

    return true;
}

/**
 * Queue all incompatible media for conversion
 */
export function queueAllIncompatible(): number {
    const incompatible = getAll<{ id: number; file_name: string }>(
        `SELECT id, file_name FROM media 
         WHERE converted_path IS NULL
         AND (
             audio_codec NOT IN ('aac', 'mp3', 'opus', 'vorbis', 'flac')
             OR video_codec NOT IN ('h264', 'avc1', 'vp8', 'vp9', 'av1')
         )
         AND audio_codec IS NOT NULL 
         AND audio_codec != 'unknown'`
    );

    let queued = 0;
    for (const media of incompatible) {
        if (queueForConversion(media.id)) {
            queued++;
        }
    }

    console.log(`📋 Queued ${queued} files for conversion`);
    return queued;
}

/**
 * Process the conversion queue
 */
function processQueue(): void {
    if (isProcessing) return;

    // Check concurrency (ignore completed/failed jobs that are just sticking around for status)
    const convertingCount = Array.from(activeJobs.values()).filter(j => j.status === 'converting').length;
    if (convertingCount >= MAX_CONCURRENT) return;

    if (jobQueue.length === 0) return;

    isProcessing = true;

    const mediaId = jobQueue.shift()!;
    startConversion(mediaId);

    isProcessing = false;
}

/**
 * Start converting a media file
 */
async function startConversion(mediaId: number): Promise<void> {
    const media = getOne<{
        id: number;
        file_path: string;
        file_name: string;
        duration_seconds: number;
    }>('SELECT id, file_path, file_name, duration_seconds FROM media WHERE id = ?', [mediaId]);

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

    const outputPath = path.resolve(getConvertedPath(mediaId));
    // Use slightly different temp name to avoid conflicts
    const tempPath = path.resolve(outputPath.replace('.mp4', `_temp_${Date.now()}.mp4`));

    // Ensure cache directory exists
    if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
    }

    console.log(`🔄 Converting: ${media.file_name}`);
    console.log(`   Input: ${media.file_path}`);
    console.log(`   Output: ${tempPath}`);

    const job: ConversionJob = {
        mediaId,
        fileName: media.file_name,
        filePath: media.file_path,
        outputPath,
        status: 'converting',
        progress: 0,
        startTime: Date.now()
    };

    activeJobs.set(mediaId, job);
    conversionEvents.emit('started', job);

    const command = ffmpeg(media.file_path)
        .outputOptions([
            '-map 0:v:0',
            '-map 0:a:0',
            '-c:v copy',       // Copy video stream
            '-c:a aac',        // Transcode audio to AAC
            '-ac 2',           // Stereo
            '-b:a 192k',       // Bitrate
            '-movflags +faststart'
        ])
        .output(tempPath)
        .on('progress', (progress) => {
            if (progress.percent && progress.percent > 0) {
                const currentProgress = Math.min(99, Math.round(progress.percent));
                if (currentProgress !== job.progress) {
                    job.progress = currentProgress;
                    conversionEvents.emit('progress', { mediaId, progress: currentProgress, fileName: job.fileName });
                }
            }
        })
        .on('end', () => {
            job.endTime = Date.now();
            job.command = undefined;

            // Rename temp to final
            setTimeout(() => {
                try {
                    if (fs.existsSync(outputPath)) {
                        fs.unlinkSync(outputPath);
                    }
                    if (fs.existsSync(tempPath)) {
                        fs.renameSync(tempPath, outputPath);

                        // Update database
                        run('UPDATE media SET converted_path = ? WHERE id = ?', [outputPath, mediaId]);

                        job.status = 'completed';
                        job.progress = 100;

                        console.log(`✅ Converted: ${media.file_name}`);
                        conversionEvents.emit('completed', job);
                    } else {
                        throw new Error('Temp file missing after conversion');
                    }
                } catch (e) {
                    console.error('Failed to finalize conversion:', e);
                    job.status = 'failed';
                    job.error = 'Failed to rename temp file';
                    conversionEvents.emit('failed', job);
                }
                processQueue();
            }, 500);
        })
        .on('error', (err: Error) => {
            console.error(`❌ FFmpeg error for ${media.file_name}:`, err.message);

            // Clean up temp file
            if (fs.existsSync(tempPath)) {
                try { fs.unlinkSync(tempPath); } catch (e) { }
            }

            job.status = 'failed';
            job.error = err.message;
            job.command = undefined;

            conversionEvents.emit('failed', job);

            // Don't remove from active jobs immediately so user can see error
            // activeJobs.delete(mediaId);

            processQueue();
        });

    // Save command ref so we can kill it if needed
    job.command = command;
    command.run();

    // Auto-cleanup finished status after 30s
    setTimeout(() => {
        if (activeJobs.get(mediaId)?.status !== 'converting') {
            activeJobs.delete(mediaId);
        }
    }, 30000);
}

/**
 * Cancel a conversion job
 */
export function cancelConversion(mediaId: number): boolean {
    // Remove from queue
    const queueIndex = jobQueue.indexOf(mediaId);
    if (queueIndex > -1) {
        jobQueue.splice(queueIndex, 1);
        conversionEvents.emit('cancelled', { mediaId });
        return true;
    }

    // Kill active job
    const job = activeJobs.get(mediaId);
    if (job && job.command) {
        job.command.kill('SIGKILL');
        activeJobs.delete(mediaId);
        conversionEvents.emit('cancelled', { mediaId });
        return true;
    }

    return false;
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
    totalFiles: number;
    totalSizeBytes: number;
    totalSizeMB: number;
} {
    let totalSize = 0;
    let totalFiles = 0;

    if (fs.existsSync(CACHE_DIR)) {
        const files = fs.readdirSync(CACHE_DIR);
        for (const file of files) {
            if (file.endsWith('.mp4')) {
                totalFiles++;
                const stat = fs.statSync(path.join(CACHE_DIR, file));
                totalSize += stat.size;
            }
        }
    }

    return {
        totalFiles,
        totalSizeBytes: totalSize,
        totalSizeMB: Math.round(totalSize / 1024 / 1024)
    };
}
