-- Media files (one record per file, including individual TV episodes)
CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- File info
  file_path TEXT UNIQUE NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  
  -- Parsed metadata
  title TEXT NOT NULL,
  year INTEGER,
  media_type TEXT CHECK(media_type IN ('movie', 'tv', 'unknown')) DEFAULT 'unknown',
  season_number INTEGER,
  episode_number INTEGER,
  episode_title TEXT,
  
  -- TMDB metadata
  tmdb_id INTEGER,
  tmdb_type TEXT,
  imdb_id TEXT,
  overview TEXT,
  tagline TEXT,
  runtime INTEGER,
  release_date TEXT,
  poster_path TEXT,
  backdrop_path TEXT,
  genres TEXT, -- JSON array
  cast_members TEXT, -- JSON array (renamed from 'cast' to avoid SQL keyword)
  director TEXT,
  rating REAL,
  vote_count INTEGER,
  
  -- Technical specs
  duration_seconds INTEGER,
  video_codec TEXT,
  audio_codec TEXT,
  width INTEGER,
  height INTEGER,
  resolution TEXT, -- "1080p", "720p", "4K"
  bitrate INTEGER,
  fps REAL,
  container_format TEXT,
  
  -- Flags
  browser_compatible INTEGER DEFAULT 0,
  has_subtitles INTEGER DEFAULT 0,
  has_multiple_audio INTEGER DEFAULT 0,
  
  -- Matching
  match_confidence INTEGER DEFAULT 0,
  match_method TEXT CHECK(match_method IN ('auto', 'manual', 'failed')) DEFAULT 'auto',
  
  -- Timestamps
  added_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  last_scanned TEXT DEFAULT CURRENT_TIMESTAMP,
  tmdb_fetched_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_media_title ON media(title);
CREATE INDEX IF NOT EXISTS idx_media_type ON media(media_type);
CREATE INDEX IF NOT EXISTS idx_media_year ON media(year);
CREATE INDEX IF NOT EXISTS idx_media_tmdb ON media(tmdb_id);
CREATE INDEX IF NOT EXISTS idx_media_show ON media(title, season_number, episode_number);

-- Playback state
CREATE TABLE IF NOT EXISTS playback_state (
  media_id INTEGER PRIMARY KEY,
  position_seconds INTEGER DEFAULT 0,
  duration_seconds INTEGER NOT NULL,
  progress_percent REAL DEFAULT 0,
  completed INTEGER DEFAULT 0,
  last_watched_at TEXT DEFAULT CURRENT_TIMESTAMP,
  watch_count INTEGER DEFAULT 1,
  FOREIGN KEY(media_id) REFERENCES media(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_playback_continue ON playback_state(last_watched_at, completed);

-- Subtitle tracks
CREATE TABLE IF NOT EXISTS subtitle_tracks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  media_id INTEGER NOT NULL,
  track_index INTEGER,
  language_code TEXT NOT NULL,
  language_name TEXT NOT NULL,
  title TEXT,
  codec TEXT,
  is_embedded INTEGER DEFAULT 1,
  external_path TEXT,
  converted_path TEXT,
  is_default INTEGER DEFAULT 0,
  is_forced INTEGER DEFAULT 0,
  is_sdh INTEGER DEFAULT 0,
  FOREIGN KEY(media_id) REFERENCES media(id) ON DELETE CASCADE
);

-- Audio tracks
CREATE TABLE IF NOT EXISTS audio_tracks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  media_id INTEGER NOT NULL,
  track_index INTEGER NOT NULL,
  language_code TEXT,
  language_name TEXT,
  title TEXT,
  codec TEXT NOT NULL,
  channels INTEGER,
  channel_layout TEXT,
  bitrate INTEGER,
  sample_rate INTEGER,
  is_default INTEGER DEFAULT 0,
  FOREIGN KEY(media_id) REFERENCES media(id) ON DELETE CASCADE
);

-- Scan paths
CREATE TABLE IF NOT EXISTS scan_paths (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT UNIQUE NOT NULL,
  enabled INTEGER DEFAULT 1,
  recursive INTEGER DEFAULT 1,
  last_scan_at TEXT,
  last_scan_duration_ms INTEGER,
  files_found INTEGER DEFAULT 0,
  added_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Scan errors
CREATE TABLE IF NOT EXISTS scan_errors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path TEXT NOT NULL,
  error_type TEXT NOT NULL,
  error_message TEXT,
  occurred_at TEXT DEFAULT CURRENT_TIMESTAMP,
  resolved INTEGER DEFAULT 0
);

-- Settings
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  type TEXT CHECK(type IN ('string', 'number', 'boolean', 'json')) DEFAULT 'string',
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO settings (key, value, type) VALUES
  ('autoplay_next_episode', 'true', 'boolean'),
  ('default_subtitle_language', 'eng', 'string'),
  ('default_audio_language', 'eng', 'string'),
  ('grid_columns', '6', 'number'),
  ('theme', 'dark', 'string'),
  ('scan_on_startup', 'true', 'boolean');

-- TMDB cache
CREATE TABLE IF NOT EXISTS tmdb_cache (
  cache_key TEXT PRIMARY KEY,
  tmdb_id INTEGER NOT NULL,
  data TEXT NOT NULL,
  cached_at TEXT DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT
);
