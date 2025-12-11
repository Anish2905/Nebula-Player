/**
 * Types for the media player application
 */

export interface Media {
    id: number;
    file_path: string;
    file_name: string;
    file_size: number;
    title: string;
    year?: number;
    media_type: 'movie' | 'tv' | 'unknown';
    season_number?: number;
    episode_number?: number;
    episode_title?: string;
    tmdb_id?: number;
    tmdb_type?: string;
    imdb_id?: string;
    overview?: string;
    tagline?: string;
    runtime?: number;
    release_date?: string;
    poster_path?: string;
    backdrop_path?: string;
    genres?: string;
    cast_members?: string;
    director?: string;
    rating?: number;
    vote_count?: number;
    duration_seconds?: number;
    video_codec?: string;
    audio_codec?: string;
    width?: number;
    height?: number;
    resolution?: string;
    bitrate?: number;
    fps?: number;
    container_format?: string;
    browser_compatible?: number;
    has_subtitles?: number;
    has_multiple_audio?: number;
    match_confidence?: number;
    match_method?: string;
    added_at?: string;
    updated_at?: string;
    last_scanned?: string;
    tmdb_fetched_at?: string;
    subtitle_tracks?: SubtitleTrack[];
    audio_tracks?: AudioTrack[];
    playback_state?: PlaybackState;
}

export interface SubtitleTrack {
    id: number;
    media_id: number;
    track_index: number;
    language_code: string;
    language_name: string;
    label?: string;
    title?: string;
    codec: string;
    is_embedded: number;
    external_path?: string;
    converted_path?: string;
    is_default: number;
    is_forced: number;
    is_sdh: number;
}

export interface AudioTrack {
    id: number;
    media_id: number;
    track_index: number;
    language_code?: string;
    language_name?: string;
    title?: string;
    codec: string;
    channels: number;
    channel_layout?: string;
    bitrate?: number;
    sample_rate?: number;
    is_default: number;
}

export interface PlaybackState {
    media_id: number;
    position_seconds: number;
    duration_seconds: number;
    progress_percent: number;
    completed: number;
    last_watched_at?: string;
    watch_count: number;
}

export interface ScanPath {
    id: number;
    path: string;
    enabled: boolean;
    recursive: boolean;
    last_scan_at?: string;
    files_found: number;
    exists: boolean;
}

export interface CastMember {
    name: string;
    character: string;
    profile_path?: string;
}

export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export interface SearchParams {
    q?: string;
    genre?: string;
    year?: number;
    yearFrom?: number;
    yearTo?: number;
    resolution?: string;
    type?: string;
    compatible?: boolean;
    sort?: string;
    order?: string;
    page?: number;
    limit?: number;
}
