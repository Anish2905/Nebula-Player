/**
 * TMDB Service - Fetches movie/TV metadata from The Movie Database
 */

import axios from 'axios';
import { getOne, getAll, run } from '../db.js';

const TMDB_API_KEY = process.env.TMDB_API_KEY || '';
const TMDB_BASE_URL = process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = process.env.TMDB_IMAGE_BASE_URL || 'https://image.tmdb.org/t/p';

// Rate limiting: max 40 requests per 10 seconds
let requestQueue: number[] = [];
const RATE_LIMIT = 40;
const RATE_WINDOW = 10000; // 10 seconds

async function throttle(): Promise<void> {
    const now = Date.now();
    requestQueue = requestQueue.filter(t => now - t < RATE_WINDOW);

    if (requestQueue.length >= RATE_LIMIT) {
        const oldestRequest = requestQueue[0];
        const waitTime = RATE_WINDOW - (now - oldestRequest);
        await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    requestQueue.push(Date.now());
}

interface TMDBSearchResult {
    id: number;
    title?: string;
    name?: string;
    original_title?: string;
    original_name?: string;
    release_date?: string;
    first_air_date?: string;
    overview?: string;
    poster_path?: string;
    backdrop_path?: string;
    vote_average?: number;
    vote_count?: number;
    genre_ids?: number[];
}

interface TMDBMovieDetails {
    id: number;
    imdb_id?: string;
    title: string;
    original_title: string;
    tagline?: string;
    overview?: string;
    release_date?: string;
    runtime?: number;
    poster_path?: string;
    backdrop_path?: string;
    vote_average?: number;
    vote_count?: number;
    genres?: { id: number; name: string }[];
    credits?: {
        cast?: { id: number; name: string; character: string; profile_path?: string }[];
        crew?: { id: number; name: string; job: string }[];
    };
}

interface TMDBTVDetails {
    id: number;
    name: string;
    original_name: string;
    tagline?: string;
    overview?: string;
    first_air_date?: string;
    episode_run_time?: number[];
    poster_path?: string;
    backdrop_path?: string;
    vote_average?: number;
    vote_count?: number;
    genres?: { id: number; name: string }[];
    credits?: {
        cast?: { id: number; name: string; character: string; profile_path?: string }[];
        crew?: { id: number; name: string; job: string }[];
    };
}

interface TMDBEpisodeDetails {
    id: number;
    name: string;
    overview: string;
    air_date: string;
    episode_number: number;
    season_number: number;
    still_path: string;
    vote_average: number;
    vote_count: number;
    runtime: number;
    crew?: { id: number; name: string; job: string }[];
    guest_stars?: { id: number; name: string; character: string; profile_path?: string }[];
}

export interface TMDBMetadata {
    tmdb_id: number;
    tmdb_type: 'movie' | 'tv';
    imdb_id?: string;
    title: string;
    overview?: string;
    tagline?: string;
    runtime?: number;
    release_date?: string;
    poster_path?: string;
    backdrop_path?: string;
    genres: string[];
    cast: { name: string; character: string; profile_path?: string }[];
    director?: string;
    rating?: number;
    vote_count?: number;
    match_confidence: number;
    season_number?: number;
    episode_number?: number;
}

/**
 * Calculate match confidence between search query and result
 */
function calculateConfidence(query: string, result: TMDBSearchResult, year?: number): number {
    let confidence = 0;

    const resultTitle = (result.title || result.name || '').toLowerCase();
    const queryLower = query.toLowerCase();

    // Exact title match
    if (resultTitle === queryLower) {
        confidence += 50;
    } else if (resultTitle.includes(queryLower) || queryLower.includes(resultTitle)) {
        confidence += 30;
    } else {
        // Partial word match
        const queryWords = queryLower.split(/\s+/);
        const titleWords = resultTitle.split(/\s+/);
        const matchingWords = queryWords.filter(w => titleWords.includes(w));
        confidence += Math.round((matchingWords.length / queryWords.length) * 30);
    }

    // Year match
    if (year) {
        const resultYear = result.release_date || result.first_air_date;
        if (resultYear) {
            const parsedYear = parseInt(resultYear.substring(0, 4));
            if (parsedYear === year) {
                confidence += 40;
            } else if (Math.abs(parsedYear - year) <= 1) {
                confidence += 20;
            }
        }
    } else {
        // No year provided, give partial credit
        confidence += 10;
    }

    // Popular/well-reviewed bonus
    if (result.vote_count && result.vote_count > 1000) {
        confidence += 5;
    }
    if (result.vote_average && result.vote_average > 7) {
        confidence += 5;
    }

    return Math.min(confidence, 100);
}

/**
 * Search for a movie or TV show on TMDB
 */
export async function searchTMDB(
    title: string,
    type: 'movie' | 'tv' | 'unknown',
    year?: number
): Promise<TMDBSearchResult[]> {
    if (!TMDB_API_KEY) {
        console.warn('⚠️ TMDB_API_KEY not configured');
        return [];
    }

    await throttle();

    try {
        console.log(`🎬 TMDB Search: "${title}" (${type}, ${year})`);
        // If type is unknown, search both movies and TV
        if (type === 'unknown') {
            const [movieResults, tvResults] = await Promise.all([
                searchTMDB(title, 'movie', year),
                searchTMDB(title, 'tv', year),
            ]);
            return [...movieResults, ...tvResults];
        }

        const endpoint = type === 'movie' ? '/search/movie' : '/search/tv';
        const params: Record<string, string> = {
            api_key: TMDB_API_KEY,
            query: title,
            include_adult: 'false',
        };

        if (year) {
            params[type === 'movie' ? 'year' : 'first_air_date_year'] = year.toString();
        }

        console.log(`   Calling TMDB: ${endpoint} with params`, JSON.stringify(params));
        const response = await axios.get(`${TMDB_BASE_URL}${endpoint}`, { params });
        console.log(`   ✅ TMDB Response: Found ${response.data.results?.length || 0} results`);
        return response.data.results || [];
    } catch (err) {
        console.error('TMDB search error:', err);
        return [];
    }
}

/**
 * Get detailed movie information
 */
async function getMovieDetails(id: number): Promise<TMDBMovieDetails | null> {
    await throttle();

    try {
        const response = await axios.get(`${TMDB_BASE_URL}/movie/${id}`, {
            params: {
                api_key: TMDB_API_KEY,
                append_to_response: 'credits',
            },
        });
        return response.data;
    } catch (err) {
        console.error('TMDB movie details error:', err);
        return null;
    }
}

/**
 * Get detailed TV show information
 */
async function getTVDetails(id: number): Promise<TMDBTVDetails | null> {
    await throttle();

    try {
        const response = await axios.get(`${TMDB_BASE_URL}/tv/${id}`, {
            params: {
                api_key: TMDB_API_KEY,
                append_to_response: 'credits',
            },
        });
        return response.data;
    } catch (err) {
        console.error('TMDB TV details error:', err);
        return null;
    }
}

/**
 * Get detailed episode information
 */
async function getEpisodeDetails(tvId: number, season: number, episode: number): Promise<TMDBEpisodeDetails | null> {
    await throttle();

    try {
        const response = await axios.get(`${TMDB_BASE_URL}/tv/${tvId}/season/${season}/episode/${episode}`, {
            params: {
                api_key: TMDB_API_KEY,
                append_to_response: 'credits',
            },
        });
        return response.data;
    } catch (err) {
        // Simple error logging
        if (axios.isAxiosError(err) && err.response?.status === 404) {
            console.log(`Episode not found on TMDB: TV ${tvId} S${season}E${episode}`);
        } else {
            console.error('TMDB episode details error:', err);
        }
        return null;
    }
}

/**
 * Fetch full metadata for a media item
 */
export async function fetchMetadata(
    title: string,
    type: 'movie' | 'tv' | 'unknown',
    year?: number,
    season?: number,
    episode?: number
): Promise<TMDBMetadata | null> {
    // Check cache first (include season/episode in key)
    const exactCacheKey = `${type}:${title}:${year || ''}:${season || ''}:${episode || ''}`;
    const cached = getOne<{ data: string; expires_at: string }>(
        'SELECT data, expires_at FROM tmdb_cache WHERE cache_key = ?',
        [exactCacheKey]
    );

    if (cached && new Date(cached.expires_at) > new Date()) {
        return JSON.parse(cached.data);
    }

    // Search for matches
    const results = await searchTMDB(title, type, year);

    if (results.length === 0) {
        return null;
    }

    // Find best match
    let bestMatch = results[0];
    let bestConfidence = calculateConfidence(title, results[0], year);
    let matchType: 'movie' | 'tv' = results[0].title ? 'movie' : 'tv';

    for (const result of results.slice(1)) {
        const confidence = calculateConfidence(title, result, year);
        if (confidence > bestConfidence) {
            bestMatch = result;
            bestConfidence = confidence;
            matchType = result.title ? 'movie' : 'tv';
        }
    }

    // Fetch full details
    let metadata: TMDBMetadata;

    if (matchType === 'movie') {
        const details = await getMovieDetails(bestMatch.id);
        if (!details) return null;

        const director = details.credits?.crew?.find(c => c.job === 'Director');

        metadata = {
            tmdb_id: details.id,
            tmdb_type: 'movie',
            imdb_id: details.imdb_id,
            title: details.title,
            overview: details.overview,
            tagline: details.tagline,
            runtime: details.runtime,
            release_date: details.release_date,
            poster_path: details.poster_path ? `${TMDB_IMAGE_BASE_URL}/w500${details.poster_path}` : undefined,
            backdrop_path: details.backdrop_path ? `${TMDB_IMAGE_BASE_URL}/w1280${details.backdrop_path}` : undefined,
            genres: details.genres?.map(g => g.name) || [],
            cast: details.credits?.cast?.slice(0, 10).map(c => ({
                name: c.name,
                character: c.character,
                profile_path: c.profile_path ? `${TMDB_IMAGE_BASE_URL}/w185${c.profile_path}` : undefined,
            })) || [],
            director: director?.name,
            rating: details.vote_average,
            vote_count: details.vote_count,
            match_confidence: bestConfidence,
        };
    } else {
        // It's a TV show
        const showDetails = await getTVDetails(bestMatch.id);
        if (!showDetails) return null;

        let episodeDetails: TMDBEpisodeDetails | null = null;
        if (season && episode) {
            episodeDetails = await getEpisodeDetails(bestMatch.id, season, episode);
        }

        const creator = showDetails.credits?.crew?.find(c => c.job === 'Creator' || c.job === 'Executive Producer');

        // Use episode specific info if available, fallback to show info
        metadata = {
            tmdb_id: showDetails.id,
            tmdb_type: 'tv',
            title: episodeDetails?.name || showDetails.name, // Episode name or Show name
            overview: episodeDetails?.overview || showDetails.overview,
            tagline: showDetails.tagline,
            runtime: episodeDetails?.runtime || showDetails.episode_run_time?.[0],
            release_date: episodeDetails?.air_date || showDetails.first_air_date,
            // Prefer episode still for backdrop/poster context if needed, but usually poster is show poster
            // We use still_path as backdrop for episodes in many UIs, or a specific field
            poster_path: showDetails.poster_path ? `${TMDB_IMAGE_BASE_URL}/w500${showDetails.poster_path}` : undefined,
            // Use episode still as backdrop if available
            backdrop_path: episodeDetails?.still_path
                ? `${TMDB_IMAGE_BASE_URL}/original${episodeDetails.still_path}`
                : (showDetails.backdrop_path ? `${TMDB_IMAGE_BASE_URL}/w1280${showDetails.backdrop_path}` : undefined),
            genres: showDetails.genres?.map(g => g.name) || [],
            cast: (episodeDetails?.guest_stars || showDetails.credits?.cast)?.slice(0, 10).map(c => ({
                name: c.name,
                character: c.character,
                profile_path: c.profile_path ? `${TMDB_IMAGE_BASE_URL}/w185${c.profile_path}` : undefined,
            })) || [],
            director: creator?.name,
            rating: episodeDetails?.vote_average || showDetails.vote_average,
            vote_count: episodeDetails?.vote_count || showDetails.vote_count,
            match_confidence: bestConfidence,
            season_number: season,
            episode_number: episode
        };
    }

    // Cache result for 30 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    run(`
    INSERT INTO tmdb_cache (cache_key, tmdb_id, data, expires_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(cache_key) DO UPDATE SET
      data = ?,
      cached_at = CURRENT_TIMESTAMP,
      expires_at = ?
  `, [exactCacheKey, metadata.tmdb_id, JSON.stringify(metadata), expiresAt.toISOString(), JSON.stringify(metadata), expiresAt.toISOString()]);

    return metadata;
}

/**
 * Enrich a media record with TMDB metadata
 */
export async function enrichMedia(mediaId: number): Promise<boolean> {
    const media = getOne<{ id: number; title: string; year: number; media_type: string; season_number?: number; episode_number?: number }>(
        'SELECT id, title, year, media_type, season_number, episode_number FROM media WHERE id = ?',
        [mediaId]
    );

    if (!media) {
        return false;
    }

    const metadata = await fetchMetadata(
        media.title,
        media.media_type as 'movie' | 'tv' | 'unknown',
        media.year,
        media.season_number,
        media.episode_number
    );

    if (!metadata) {
        run('UPDATE media SET match_method = ? WHERE id = ?', ['failed', mediaId]);
        return false;
    }

    run(`
    UPDATE media SET
      tmdb_id = ?,
      tmdb_type = ?,
      media_type = ?,
      imdb_id = ?,
      episode_title = ?, -- Store episode title separately if it's TV
      overview = ?,
      tagline = ?,
      runtime = ?,
      release_date = ?,
      poster_path = ?,
      backdrop_path = ?,
      genres = ?,
      cast_members = ?,
      director = ?,
      rating = ?,
      vote_count = ?,
      match_confidence = ?,
      match_method = 'auto',
      tmdb_fetched_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [
        metadata.tmdb_id,
        metadata.tmdb_type,
        metadata.tmdb_type, // Also update media_type to match TMDB type
        metadata.imdb_id || null,
        (metadata.tmdb_type === 'tv' && metadata.title !== media.title) ? metadata.title : null, // Use this for episode_title
        metadata.overview || null,
        metadata.tagline || null,
        metadata.runtime || null,
        metadata.release_date || null,
        metadata.poster_path || null,
        metadata.backdrop_path || null,
        JSON.stringify(metadata.genres),
        JSON.stringify(metadata.cast),
        metadata.director || null,
        metadata.rating || null,
        metadata.vote_count || null,
        metadata.match_confidence,
        mediaId,
    ]);

    return true;
}

/**
 * Enrich all media without TMDB data
 */
export async function enrichAllMedia(batchSize: number = 20): Promise<number> {
    let totalEnriched = 0;

    while (true) {
        const media = getAll<{ id: number; title: string; year: number; media_type: string }>(
            `SELECT id, title, year, media_type 
             FROM media 
             WHERE (tmdb_id IS NULL OR (media_type = 'tv' AND episode_title IS NULL))
             AND match_method IS NULL
             LIMIT ?`,
            [batchSize]
        );

        if (media.length === 0) break;

        console.log(`🎬 Processing batch of ${media.length} items for enrichment...`);

        for (const item of media) {
            console.log(`   Enriching: ${item.title}${item.year ? ` (${item.year})` : ''}`);
            const success = await enrichMedia(item.id);
            if (success) {
                totalEnriched++;
                console.log('   ✅ Found match');
            } else {
                console.log('   ❌ No match');
            }
        }
    }

    return totalEnriched;
}
