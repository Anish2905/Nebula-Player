/**
 * Metadata Extractor - Uses FFprobe to extract video metadata
 */

import ffmpeg from 'fluent-ffmpeg';
import path from 'path';

export interface VideoMetadata {
    duration: number; // seconds
    videoCodec: string;
    audioCodec: string;
    width: number;
    height: number;
    resolution: string;
    bitrate: number;
    fps: number;
    container: string;
    subtitleTracks: SubtitleTrack[];
    audioTracks: AudioTrack[];
}

export interface SubtitleTrack {
    index: number;
    languageCode: string;
    languageName: string;
    title?: string;
    codec: string;
    isDefault: boolean;
    isForced: boolean;
    isEmbedded: boolean;
    externalPath?: string;
}

export interface AudioTrack {
    index: number;
    languageCode?: string;
    languageName?: string;
    title?: string;
    codec: string;
    channels: number;
    channelLayout?: string;
    bitrate?: number;
    sampleRate?: number;
    isDefault: boolean;
}

// Language code to name mapping (common ones)
const LANGUAGE_NAMES: Record<string, string> = {
    eng: 'English',
    en: 'English',
    spa: 'Spanish',
    es: 'Spanish',
    fre: 'French',
    fr: 'French',
    ger: 'German',
    de: 'German',
    jpn: 'Japanese',
    ja: 'Japanese',
    kor: 'Korean',
    ko: 'Korean',
    chi: 'Chinese',
    zh: 'Chinese',
    hin: 'Hindi',
    hi: 'Hindi',
    ita: 'Italian',
    it: 'Italian',
    por: 'Portuguese',
    pt: 'Portuguese',
    rus: 'Russian',
    ru: 'Russian',
    ara: 'Arabic',
    ar: 'Arabic',
    und: 'Unknown',
};

function getLanguageName(code: string | undefined): string {
    if (!code) return 'Unknown';
    return LANGUAGE_NAMES[code.toLowerCase()] || code;
}

function getResolutionLabel(width: number, height: number): string {
    if (height >= 2160 || width >= 3840) return '4K';
    if (height >= 1080 || width >= 1920) return '1080p';
    if (height >= 720 || width >= 1280) return '720p';
    if (height >= 480 || width >= 854) return '480p';
    return 'SD';
}

/**
 * Extract metadata from a video file using FFprobe
 */
export function extractMetadata(filePath: string): Promise<VideoMetadata> {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                reject(new Error(`FFprobe error: ${err.message}`));
                return;
            }

            const format = metadata.format;
            const streams = metadata.streams || [];

            // Find video stream
            const videoStream = streams.find(s => s.codec_type === 'video');
            if (!videoStream) {
                reject(new Error('No video stream found'));
                return;
            }

            // Find audio streams
            const audioStreams = streams.filter(s => s.codec_type === 'audio');

            // Find subtitle streams
            const subtitleStreams = streams.filter(s => s.codec_type === 'subtitle');

            // Calculate FPS
            let fps = 0;
            if (videoStream.r_frame_rate) {
                const [num, den] = videoStream.r_frame_rate.split('/').map(Number);
                fps = den ? num / den : num;
            }

            const width = videoStream.width || 0;
            const height = videoStream.height || 0;

            const result: VideoMetadata = {
                duration: Math.round(format.duration || 0),
                videoCodec: videoStream.codec_name || 'unknown',
                audioCodec: audioStreams[0]?.codec_name || 'unknown',
                width,
                height,
                resolution: getResolutionLabel(width, height),
                bitrate: Math.round((format.bit_rate || 0) / 1000), // kbps
                fps: Math.round(fps * 100) / 100,
                container: path.extname(filePath).slice(1).toLowerCase(),
                subtitleTracks: subtitleStreams.map((s, i) => ({
                    index: s.index,
                    languageCode: s.tags?.language || 'und',
                    languageName: getLanguageName(s.tags?.language),
                    title: s.tags?.title,
                    codec: s.codec_name || 'unknown',
                    isDefault: s.disposition?.default === 1,
                    isForced: s.disposition?.forced === 1,
                    isEmbedded: true,
                })),
                audioTracks: audioStreams.map((s, i) => ({
                    index: s.index,
                    languageCode: s.tags?.language,
                    languageName: getLanguageName(s.tags?.language),
                    title: s.tags?.title,
                    codec: s.codec_name || 'unknown',
                    channels: s.channels || 2,
                    channelLayout: s.channel_layout,
                    bitrate: s.bit_rate ? Math.round(Number(s.bit_rate) / 1000) : undefined,
                    sampleRate: s.sample_rate ? Number(s.sample_rate) : undefined,
                    isDefault: s.disposition?.default === 1,
                })),
            };

            resolve(result);
        });
    });
}
