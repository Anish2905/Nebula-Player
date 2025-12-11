export interface Media {
    id: number;
    file_path: string;
    file_name: string;
    title: string | null;
    year: number | null;
    media_type: 'movie' | 'tv' | 'other';
    season_number: number | null;
    episode_number: number | null;
    episode_title?: string | null;
    tmdb_id: number | null;
    tmdb_type?: 'movie' | 'tv';
    imdb_id?: string;
    overview: string | null;
    tagline?: string;
    poster_path: string | null;
    backdrop_path: string | null;
    genres: string | null; // JSON string
    rating: number | null;
    vote_count: number | null;
    runtime: number | null;
    resolution: string | null;
    video_codec: string | null;
    audio_codec: string | null;
    browser_compatible: number; // 0 or 1
    has_subtitles: number; // 0 or 1
    duration_seconds: number;
    added_at: string;
    converted_path: string | null;
    cast_members?: string;
    director?: string;
    match_method?: string;
    last_scanned?: string;
    tmdb_fetched_at?: string;
}

export interface SubtitleTrack {
    id: number;
    media_id: number;
    language_code: string | null;
    language_name: string | null;
    label: string | null;
    title?: string | null;
    codec?: string | null;
    is_embedded: number;
    is_default: number;
    is_forced?: number;
    external_path: string | null;
    track_index: number | null;
    converted_path: string | null;
}

export interface AudioTrack {
    id: number;
    media_id: number;
    language_code: string | null;
    language_name: string | null;
    label: string | null;
    title?: string | null;
    codec: string | null;
    channels: number | null;
    channel_layout?: string | null;
    bitrate?: number | null;
    sample_rate?: number;
    is_default: number;
    track_index: number;
}

export interface PlaybackState {
    id: number;
    media_id: number;
    position_seconds: number;
    duration_seconds: number;
    progress_percent: number;
    completed: number; // 0 or 1
    last_watched_at: string;
    watch_count: number;
    volume?: number;
    is_muted?: number;
}

export interface ScanPath {
    id: number;
    path: string;
    type: 'movies' | 'tv' | 'mixed';
    enabled: number;
}
