/**
 * Filename Parser - Extracts metadata from video filenames
 * Supports patterns for movies and TV shows
 */

export interface ParsedFilename {
    title: string;
    year?: number;
    season?: number;
    episode?: number;
    episodeTitle?: string;
    mediaType: 'movie' | 'tv' | 'unknown';
    resolution?: string;
    quality?: string;
}

// Common words to strip from titles
const NOISE_WORDS = [
    'bluray', 'bdrip', 'brrip', 'dvdrip', 'hdtv', 'webrip', 'web-dl', 'webdl',
    'hdrip', 'x264', 'x265', 'h264', 'h265', 'hevc', 'aac', 'ac3', 'dts',
    '10bit', '8bit', 'remux', 'proper', 'repack', 'internal', 'extended',
    'unrated', 'directors', 'cut', 'edition', 'remastered', 'dubbed', 'subbed',
    'multi', 'dual', 'audio', 'eng', 'english', 'hindi', 'japanese'
];

// Resolution patterns
const RESOLUTION_PATTERNS = [
    { pattern: /\b(2160p|4k|uhd)\b/i, value: '4K' },
    { pattern: /\b1080p\b/i, value: '1080p' },
    { pattern: /\b720p\b/i, value: '720p' },
    { pattern: /\b480p\b/i, value: '480p' },
    { pattern: /\b(sd|dvd)\b/i, value: 'SD' },
];

// TV Show patterns
const TV_PATTERNS = [
    // S01E01 format
    /^(.+?)[.\s_-]*S(\d{1,2})E(\d{1,2})(?:[.\s_-]*(.+?))?$/i,
    // 1x01 format
    /^(.+?)[.\s_-]*(\d{1,2})x(\d{1,2})(?:[.\s_-]*(.+?))?$/i,
    // Season 1 Episode 1 format
    /^(.+?)[.\s_-]*Season[.\s_-]*(\d{1,2})[.\s_-]*Episode[.\s_-]*(\d{1,2})(?:[.\s_-]*(.+?))?$/i,
];

// Movie patterns
const MOVIE_PATTERNS = [
    // Title (2020)
    /^(.+?)\s*\((\d{4})\)/,
    // Title.2020.
    /^(.+?)[.\s_-](\d{4})[.\s_-]/,
    // Just title with year at end before extension
    /^(.+?)[.\s_-](\d{4})$/,
];

/**
 * Clean up a title by replacing dots/underscores with spaces and removing noise
 */
function cleanTitle(title: string): string {
    // Replace dots and underscores with spaces
    let cleaned = title.replace(/[._]/g, ' ');

    // Remove noise words
    const words = cleaned.split(/\s+/);
    const filtered = words.filter(word =>
        !NOISE_WORDS.includes(word.toLowerCase())
    );

    // Rejoin and clean up extra spaces
    cleaned = filtered.join(' ').replace(/\s+/g, ' ').trim();

    // Title case
    return cleaned
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

/**
 * Extract resolution from filename
 */
function extractResolution(filename: string): string | undefined {
    for (const { pattern, value } of RESOLUTION_PATTERNS) {
        if (pattern.test(filename)) {
            return value;
        }
    }
    return undefined;
}

/**
 * Parse a filename and extract metadata
 */
export function parseFilename(filename: string): ParsedFilename {
    // Remove extension
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');

    // Extract resolution first
    const resolution = extractResolution(nameWithoutExt);

    // Try TV patterns first
    for (const pattern of TV_PATTERNS) {
        const match = nameWithoutExt.match(pattern);
        if (match) {
            return {
                title: cleanTitle(match[1]),
                season: parseInt(match[2], 10),
                episode: parseInt(match[3], 10),
                episodeTitle: match[4] ? cleanTitle(match[4]) : undefined,
                mediaType: 'tv',
                resolution,
            };
        }
    }

    // Try movie patterns
    for (const pattern of MOVIE_PATTERNS) {
        const match = nameWithoutExt.match(pattern);
        if (match) {
            const year = parseInt(match[2], 10);
            // Sanity check on year (1888 = first film, 2099 = reasonable future)
            if (year >= 1888 && year <= 2099) {
                return {
                    title: cleanTitle(match[1]),
                    year,
                    mediaType: 'movie',
                    resolution,
                };
            }
        }
    }

    // Fallback: just use the filename as title
    return {
        title: cleanTitle(nameWithoutExt),
        mediaType: 'unknown',
        resolution,
    };
}

/**
 * Determine if a file is a video based on extension
 */
export function isVideoFile(filename: string): boolean {
    const videoExtensions = ['.mp4', '.mkv', '.avi', '.webm', '.mov', '.m4v', '.wmv', '.flv'];
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return videoExtensions.includes(ext);
}

/**
 * Determine browser compatibility based on format
 */
export function isBrowserCompatible(videoCodec: string, audioCodec: string, container: string): boolean {
    const compatibleVideoCodecs = ['h264', 'avc1', 'vp8', 'vp9', 'av1'];
    const compatibleAudioCodecs = ['aac', 'mp3', 'opus', 'vorbis', 'flac'];
    const compatibleContainers = ['mp4', 'webm', 'ogg'];

    const videoOk = compatibleVideoCodecs.some(c => videoCodec?.toLowerCase().includes(c));
    const audioOk = compatibleAudioCodecs.some(c => audioCodec?.toLowerCase().includes(c));
    const containerOk = compatibleContainers.some(c => container?.toLowerCase().includes(c));

    return videoOk && audioOk && containerOk;
}
