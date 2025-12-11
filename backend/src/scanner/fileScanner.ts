/**
 * File Scanner - Recursively scans directories for video files
 */

import fs from 'fs';
import path from 'path';
import db, { getAll, getOne, run, insert } from '../db.js';
import { parseFilename, isVideoFile, isBrowserCompatible } from './filenameParser.js';
import { extractMetadata } from './metadataExtractor.js';

interface ScanResult {
    totalFiles: number;
    newFiles: number;
    updatedFiles: number;
    errors: number;
    duration: number;
}

/**
 * Recursively find all video files in a directory
 */
function findVideoFiles(dir: string, recursive: boolean = true): string[] {
    const files: string[] = [];

    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory() && recursive) {
                // Skip hidden directories and common non-media folders
                if (!entry.name.startsWith('.') && !['node_modules', '@eaDir', 'Thumbs'].includes(entry.name)) {
                    files.push(...findVideoFiles(fullPath, recursive));
                }
            } else if (entry.isFile() && isVideoFile(entry.name)) {
                files.push(fullPath);
            }
        }
    } catch (err) {
        console.error(`Error scanning directory ${dir}:`, err);
    }

    return files;
}

/**
 * Process a single video file and add/update in database
 */
async function processFile(filePath: string): Promise<boolean> {
    try {
        const stats = fs.statSync(filePath);
        const fileName = path.basename(filePath);

        // Check if file already exists in database
        const existing = getOne<{ id: number; file_size: number }>(
            'SELECT id, file_size FROM media WHERE file_path = ?',
            [filePath]
        );

        // If file exists and size hasn't changed, skip processing
        // Optimization disabled to force subtitle re-scan
        /*
        if (existing && existing.file_size === stats.size) {
            run('UPDATE media SET last_scanned = CURRENT_TIMESTAMP WHERE id = ?', [existing.id]);
            return false; // Not a new file
        }
        */

        // Parse filename for metadata
        const parsed = parseFilename(fileName);

        // Extract technical metadata using FFprobe
        let metadata;
        try {
            metadata = await extractMetadata(filePath);
        } catch (err) {
            console.warn(`  ⚠️ Could not extract metadata for ${fileName}:`, err);
            // Insert with minimal info
            metadata = {
                duration: 0,
                videoCodec: 'unknown',
                audioCodec: 'unknown',
                width: 0,
                height: 0,
                resolution: 'unknown',
                bitrate: 0,
                fps: 0,
                container: path.extname(filePath).slice(1),
                subtitleTracks: [],
                audioTracks: [],
            };
        }

        // Scan for external subtitles
        try {
            const dir = path.dirname(filePath);
            const ext = path.extname(filePath);
            const basename = path.basename(filePath, ext);
            // console.log(`DEBUG: Scanning dir ${dir} for basename ${basename}`);
            const files = fs.readdirSync(dir);
            // console.log(`DEBUG: Files in dir: ${files.join(', ')}`);

            const subtitleFiles = files.filter(f => {
                const fLower = f.toLowerCase();
                const match = f.startsWith(basename) && (fLower.endsWith('.srt') || fLower.endsWith('.vtt'));
                if (match) console.log(`DEBUG: Match found: ${f}`);
                return match;
            });

            if (subtitleFiles.length > 0) {
                console.log(`Found external subs for ${fileName}:`, subtitleFiles);
            }

            for (const subFile of subtitleFiles) {
                // Skip if it's the video file itself (unlikely due to extension check but safety first)
                if (subFile === fileName) continue;

                const subExt = path.extname(subFile).toLowerCase();
                const subPath = path.join(dir, subFile);

                // Try to guess language from filename parts (e.g. Movie.en.srt -> en)
                // Remove basename and extension
                const parts = subFile.slice(basename.length, -subExt.length).split(/[._-]/).filter(p => p.length > 0);

                // Simple language detection details
                let langCode = 'und';
                let langName = 'Unknown (External)';
                let title = subFile;

                const commonLangs: Record<string, string> = {
                    'en': 'English', 'eng': 'English',
                    'es': 'Spanish', 'spa': 'Spanish',
                    'fr': 'French', 'fre': 'French',
                    'de': 'German', 'ger': 'German',
                    'it': 'Italian', 'ita': 'Italian',
                    'pt': 'Portuguese', 'por': 'Portuguese',
                    'ru': 'Russian', 'rus': 'Russian',
                    'ja': 'Japanese', 'jpn': 'Japanese',
                    'zh': 'Chinese', 'chi': 'Chinese',
                    'hi': 'Hindi', 'hin': 'Hindi',
                    'ko': 'Korean', 'kor': 'Korean',
                };

                for (const part of parts) {
                    const lower = part.toLowerCase();
                    if (commonLangs[lower]) {
                        langCode = lower.length === 2 ? lower : lower.substring(0, 3); // approximations
                        langName = commonLangs[lower] + ' (External)';
                        break;
                    }
                }

                metadata.subtitleTracks.push({
                    index: 0, // Not relevant for external
                    languageCode: langCode,
                    languageName: langName,
                    title: title,
                    codec: subExt.slice(1),
                    isDefault: false,
                    isForced: false,
                    isEmbedded: false,
                    externalPath: subPath
                });
            }
        } catch (err) {
            console.warn(`  ⚠️ Error checking external subtitles for ${fileName}:`, err);
        }

        const browserCompatible = isBrowserCompatible(
            metadata.videoCodec,
            metadata.audioCodec,
            metadata.container
        );

        if (existing) {
            // Update existing record
            run(`
        UPDATE media SET
          file_name = ?,
          file_size = ?,
          title = ?,
          year = ?,
          media_type = ?,
          season_number = ?,
          episode_number = ?,
          episode_title = ?,
          duration_seconds = ?,
          video_codec = ?,
          audio_codec = ?,
          width = ?,
          height = ?,
          resolution = ?,
          bitrate = ?,
          fps = ?,
          container_format = ?,
          browser_compatible = ?,
          has_subtitles = ?,
          has_multiple_audio = ?,
          updated_at = CURRENT_TIMESTAMP,
          last_scanned = CURRENT_TIMESTAMP,
          match_method = NULL,
          tmdb_id = NULL
        WHERE id = ?
      `, [
                fileName,
                stats.size,
                parsed.title,
                parsed.year || null,
                parsed.mediaType,
                parsed.season || null,
                parsed.episode || null,
                parsed.episodeTitle || null,
                metadata.duration,
                metadata.videoCodec,
                metadata.audioCodec,
                metadata.width,
                metadata.height,
                metadata.resolution,
                metadata.bitrate,
                metadata.fps,
                metadata.container,
                browserCompatible ? 1 : 0,
                metadata.subtitleTracks.length > 0 ? 1 : 0,
                metadata.audioTracks.length > 1 ? 1 : 0,
                existing.id,
            ]);

            // Update tracks
            run('DELETE FROM subtitle_tracks WHERE media_id = ?', [existing.id]);
            run('DELETE FROM audio_tracks WHERE media_id = ?', [existing.id]);

            for (const track of metadata.subtitleTracks) {
                insert(`
          INSERT INTO subtitle_tracks (media_id, track_index, language_code, language_name, title, codec, is_default, is_forced, is_embedded, external_path)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [existing.id, track.index, track.languageCode, track.languageName, track.title, track.codec, track.isDefault ? 1 : 0, track.isForced ? 1 : 0, track.isEmbedded ? 1 : 0, track.externalPath || null]);
            }

            for (const track of metadata.audioTracks) {
                insert(`
          INSERT INTO audio_tracks (media_id, track_index, language_code, language_name, title, codec, channels, channel_layout, bitrate, sample_rate, is_default)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [existing.id, track.index, track.languageCode, track.languageName, track.title, track.codec, track.channels, track.channelLayout, track.bitrate, track.sampleRate, track.isDefault ? 1 : 0]);
            }

            return true; // Updated
        } else {
            // Insert new record
            const mediaId = insert(`
        INSERT INTO media (
          file_path, file_name, file_size, title, year, media_type,
          season_number, episode_number, episode_title,
          duration_seconds, video_codec, audio_codec, width, height,
          resolution, bitrate, fps, container_format,
          browser_compatible, has_subtitles, has_multiple_audio
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
                filePath,
                fileName,
                stats.size,
                parsed.title,
                parsed.year || null,
                parsed.mediaType,
                parsed.season || null,
                parsed.episode || null,
                parsed.episodeTitle || null,
                metadata.duration,
                metadata.videoCodec,
                metadata.audioCodec,
                metadata.width,
                metadata.height,
                metadata.resolution,
                metadata.bitrate,
                metadata.fps,
                metadata.container,
                browserCompatible ? 1 : 0,
                metadata.subtitleTracks.length > 0 ? 1 : 0,
                metadata.audioTracks.length > 1 ? 1 : 0,
            ]);

            // Insert tracks
            for (const track of metadata.subtitleTracks) {
                insert(`
          INSERT INTO subtitle_tracks (media_id, track_index, language_code, language_name, title, codec, is_default, is_forced, is_embedded, external_path)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [mediaId, track.index, track.languageCode, track.languageName, track.title, track.codec, track.isDefault ? 1 : 0, track.isForced ? 1 : 0, track.isEmbedded ? 1 : 0, track.externalPath || null]);
            }

            for (const track of metadata.audioTracks) {
                insert(`
          INSERT INTO audio_tracks (media_id, track_index, language_code, language_name, title, codec, channels, channel_layout, bitrate, sample_rate, is_default)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [mediaId, track.index, track.languageCode, track.languageName, track.title, track.codec, track.channels, track.channelLayout, track.bitrate, track.sampleRate, track.isDefault ? 1 : 0]);
            }

            return true; // New file
        }
    } catch (err) {
        console.error(`Error processing file ${filePath}:`, err);

        // Log error to database
        insert(`
      INSERT INTO scan_errors (file_path, error_type, error_message)
      VALUES (?, ?, ?)
    `, [filePath, 'processing', err instanceof Error ? err.message : String(err)]);

        throw err;
    }
}

/**
 * Scan a directory for video files and update database
 */
export async function scanDirectory(scanPath: string, recursive: boolean = true): Promise<ScanResult> {
    const startTime = Date.now();
    console.log(`\n🔍 Scanning: ${scanPath}`);

    // Find all video files
    const files = findVideoFiles(scanPath, recursive);
    console.log(`   Found ${files.length} video files`);

    let newFiles = 0;
    let updatedFiles = 0;
    let errors = 0;

    for (let i = 0; i < files.length; i++) {
        const filePath = files[i];
        const fileName = path.basename(filePath);

        try {
            process.stdout.write(`   [${i + 1}/${files.length}] ${fileName.substring(0, 50)}...`);
            const isNew = await processFile(filePath);
            if (isNew) {
                const existing = getOne<{ id: number }>('SELECT id FROM media WHERE file_path = ?', [filePath]);
                if (existing) {
                    updatedFiles++;
                    console.log(' ✏️ updated');
                } else {
                    newFiles++;
                    console.log(' ✅ added');
                }
            } else {
                console.log(' ⏭️ skipped');
            }
        } catch (err) {
            console.log(' ❌ error');
            errors++;
        }
    }

    const duration = Date.now() - startTime;

    // Update scan path record
    run(`
    INSERT INTO scan_paths (path, last_scan_at, last_scan_duration_ms, files_found)
    VALUES (?, CURRENT_TIMESTAMP, ?, ?)
    ON CONFLICT(path) DO UPDATE SET
      last_scan_at = CURRENT_TIMESTAMP,
      last_scan_duration_ms = ?,
      files_found = ?
  `, [scanPath, duration, files.length, duration, files.length]);

    console.log(`\n✅ Scan complete in ${(duration / 1000).toFixed(1)}s`);
    console.log(`   New: ${newFiles}, Updated: ${updatedFiles}, Errors: ${errors}`);

    // Auto-queue incompatible files for conversion
    try {
        const { queueAllIncompatible } = await import('../services/conversionService.js');
        const queued = queueAllIncompatible();
        if (queued > 0) {
            console.log(`📝 Auto-queued ${queued} files for conversion`);
        }
    } catch (e) {
        console.error('Failed to auto-queue conversions:', e);
    }

    return {
        totalFiles: files.length,
        newFiles,
        updatedFiles,
        errors,
        duration,
    };
}

/**
 * Scan all enabled paths
 */
export async function scanAllPaths(): Promise<ScanResult[]> {
    const paths = getAll<{ path: string; recursive: number }>(
        'SELECT path, recursive FROM scan_paths WHERE enabled = 1'
    );

    const results: ScanResult[] = [];

    for (const p of paths) {
        if (fs.existsSync(p.path)) {
            const result = await scanDirectory(p.path, p.recursive === 1);
            results.push(result);
        } else {
            console.warn(`⚠️ Path not found: ${p.path}`);
        }
    }

    return results;
}

/**
 * Remove media entries for files that no longer exist or are not in any library path
 */
export function cleanupMissingFiles(): number {
    const allMedia = getAll<{ id: number; file_path: string }>('SELECT id, file_path FROM media');
    const scanPaths = getAll<{ path: string }>('SELECT path FROM scan_paths WHERE enabled = 1');
    const allowedPaths = scanPaths.map(p => path.resolve(p.path));

    let removed = 0;

    for (const media of allMedia) {
        const resolvedPath = path.resolve(media.file_path);

        // Check if file exists
        if (!fs.existsSync(media.file_path)) {
            run('DELETE FROM subtitle_tracks WHERE media_id = ?', [media.id]);
            run('DELETE FROM audio_tracks WHERE media_id = ?', [media.id]);
            run('DELETE FROM playback_state WHERE media_id = ?', [media.id]);
            run('DELETE FROM media WHERE id = ?', [media.id]);
            removed++;
            console.log(`🗑️ Removed missing: ${path.basename(media.file_path)}`);
            continue;
        }

        // Check if file is in any allowed library path
        const isInLibrary = allowedPaths.some(allowed => resolvedPath.startsWith(allowed));
        if (!isInLibrary && allowedPaths.length > 0) {
            run('DELETE FROM subtitle_tracks WHERE media_id = ?', [media.id]);
            run('DELETE FROM audio_tracks WHERE media_id = ?', [media.id]);
            run('DELETE FROM playback_state WHERE media_id = ?', [media.id]);
            run('DELETE FROM media WHERE id = ?', [media.id]);
            removed++;
            console.log(`🗑️ Removed (not in library): ${path.basename(media.file_path)}`);
        }
    }

    if (removed > 0) {
        console.log(`\n🧹 Cleanup complete: removed ${removed} entries`);
    }

    return removed;
}

