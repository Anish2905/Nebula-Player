import { useParams, Link, useNavigate } from 'react-router-dom';
import { Play, ArrowLeft, Clock, Star, Calendar, Film, Check, Plus } from 'lucide-react';
import { useMediaDetails } from '../hooks/useMedia';
import { usePlayback } from '../hooks/usePlayback';
import type { CastMember } from '../types';

export default function DetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { media, loading, error, refetch } = useMediaDetails(parseInt(id!));
    const { setWatched, saving } = usePlayback(parseInt(id!));

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-t-[var(--accent)] border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (error || !media) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center text-white">
                <p className="text-xl mb-4">Media not found</p>
                <Link to="/" className="btn-primary">Go Home</Link>
            </div>
        );
    }

    // Parse JSON fields
    let genres: string[] = [];
    let cast: CastMember[] = [];
    try {
        if (media.genres) genres = JSON.parse(media.genres);
        if (media.cast_members) cast = JSON.parse(media.cast_members);
    } catch { }

    const formatDuration = (seconds?: number) => {
        if (!seconds) return null;
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        if (hours > 0) return `${hours}h ${mins}m`;
        return `${mins}m`;
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    };

    const isWatched = media.playback_state?.completed === 1;
    const progress = media.playback_state?.progress_percent || 0;

    const handleToggleWatched = async () => {
        await setWatched(!isWatched);
        refetch();
    };

    return (
        <div className="min-h-screen">
            {/* Backdrop Header */}
            <div className="relative h-[50vh] min-h-[350px]">
                {media.backdrop_path ? (
                    <img
                        src={media.backdrop_path}
                        alt={media.title}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900" />
                )}
                <div className="gradient-overlay absolute inset-0" />

                {/* Back Button */}
                <button
                    onClick={() => navigate(-1)}
                    className="absolute top-6 left-6 flex items-center gap-2 text-white/80 hover:text-white transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                    Back
                </button>
            </div>

            {/* Content */}
            <div className="relative -mt-32 px-8 pb-16">
                <div className="flex flex-col md:flex-row gap-8">
                    {/* Poster */}
                    <div className="flex-none w-48 md:w-64">
                        {media.poster_path ? (
                            <img
                                src={media.poster_path}
                                alt={media.title}
                                className="w-full rounded-lg shadow-2xl"
                            />
                        ) : (
                            <div className="w-full aspect-[2/3] rounded-lg bg-gray-800 flex items-center justify-center">
                                <Film className="w-16 h-16 text-gray-600" />
                            </div>
                        )}

                        {/* Progress Bar */}
                        {progress > 1 && progress < 95 && (
                            <div className="mt-3 bg-gray-700 rounded-full h-1.5">
                                <div
                                    className="bg-[var(--accent)] h-1.5 rounded-full"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        )}
                    </div>

                    {/* Info */}
                    <div className="flex-1">
                        <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
                            {media.title}
                        </h1>

                        {media.media_type === 'tv' && media.season_number && media.episode_number && (
                            <p className="text-lg text-[var(--accent)] mb-2">
                                Season {media.season_number}, Episode {media.episode_number}
                                {media.episode_title && ` - ${media.episode_title}`}
                            </p>
                        )}

                        {/* Meta Info */}
                        <div className="flex flex-wrap items-center gap-4 text-gray-400 mb-4">
                            {media.year && (
                                <span className="flex items-center gap-1">
                                    <Calendar className="w-4 h-4" />
                                    {media.year}
                                </span>
                            )}
                            {media.duration_seconds && (
                                <span className="flex items-center gap-1">
                                    <Clock className="w-4 h-4" />
                                    {formatDuration(media.duration_seconds)}
                                </span>
                            )}
                            {media.rating && (
                                <span className="flex items-center gap-1 text-green-400">
                                    <Star className="w-4 h-4" fill="currentColor" />
                                    {media.rating.toFixed(1)}
                                    {media.vote_count && <span className="text-gray-500">({media.vote_count.toLocaleString()})</span>}
                                </span>
                            )}
                            {media.resolution && (
                                <span className="px-2 py-0.5 bg-gray-700 rounded text-sm">{media.resolution}</span>
                            )}
                            {media.browser_compatible === 0 && (
                                <span className="px-2 py-0.5 bg-blue-600/50 rounded text-sm text-blue-200">
                                    🔄 Will be transcoded
                                </span>
                            )}
                        </div>

                        {/* Genres */}
                        {genres.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-4">
                                {genres.map(genre => (
                                    <span
                                        key={genre}
                                        className="px-3 py-1 bg-gray-800 rounded-full text-sm text-gray-300"
                                    >
                                        {genre}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Tagline */}
                        {media.tagline && (
                            <p className="text-lg text-gray-400 italic mb-3">{media.tagline}</p>
                        )}

                        {/* Overview */}
                        <p className="text-gray-300 mb-6 max-w-3xl leading-relaxed">
                            {media.overview || 'No description available.'}
                        </p>

                        {/* Actions */}
                        <div className="flex flex-wrap gap-4 mb-8">
                            <Link to={`/play/${media.id}`} className="btn-primary text-lg">
                                <Play className="w-5 h-5" fill="white" />
                                {progress > 1 && progress < 95 ? 'Resume' : 'Play'}
                            </Link>
                            <button
                                onClick={handleToggleWatched}
                                disabled={saving}
                                className="btn-secondary"
                            >
                                {isWatched ? (
                                    <>
                                        <Check className="w-5 h-5" />
                                        Watched
                                    </>
                                ) : (
                                    <>
                                        <Plus className="w-5 h-5" />
                                        Mark as Watched
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Director */}
                        {media.director && (
                            <p className="text-gray-400 mb-4">
                                <span className="text-gray-500">Director:</span> {media.director}
                            </p>
                        )}

                        {/* Cast */}
                        {cast.length > 0 && (
                            <div className="mb-8">
                                <h3 className="text-lg font-semibold text-white mb-3">Cast</h3>
                                <div className="flex gap-4 overflow-x-auto pb-2">
                                    {cast.slice(0, 8).map((member, i) => (
                                        <div key={i} className="flex-none w-24 text-center">
                                            {member.profile_path ? (
                                                <img
                                                    src={member.profile_path}
                                                    alt={member.name}
                                                    className="w-20 h-20 rounded-full object-cover mx-auto mb-2"
                                                />
                                            ) : (
                                                <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center mx-auto mb-2">
                                                    <span className="text-2xl text-gray-500">
                                                        {member.name.charAt(0)}
                                                    </span>
                                                </div>
                                            )}
                                            <p className="text-sm text-white truncate">{member.name}</p>
                                            <p className="text-xs text-gray-500 truncate">{member.character}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Technical Info */}
                        <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
                            <h3 className="text-lg font-semibold text-white mb-3">Technical Info</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                    <p className="text-gray-500">File</p>
                                    <p className="text-gray-300 truncate" title={media.file_name}>{media.file_name}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500">Size</p>
                                    <p className="text-gray-300">{formatFileSize(media.file_size)}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500">Video</p>
                                    <p className="text-gray-300 uppercase">{media.video_codec}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500">Audio</p>
                                    <p className="text-gray-300 uppercase">{media.audio_codec}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500">Resolution</p>
                                    <p className="text-gray-300">{media.width}x{media.height}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500">Bitrate</p>
                                    <p className="text-gray-300">{media.bitrate ? `${media.bitrate} kbps` : 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500">FPS</p>
                                    <p className="text-gray-300">{media.fps || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500">Container</p>
                                    <p className="text-gray-300 uppercase">{media.container_format}</p>
                                </div>
                            </div>

                            {/* Subtitle Tracks */}
                            {media.subtitle_tracks && media.subtitle_tracks.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-gray-700">
                                    <p className="text-gray-500 mb-2">Subtitles</p>
                                    <div className="flex flex-wrap gap-2">
                                        {media.subtitle_tracks.map((track, i) => (
                                            <span
                                                key={i}
                                                className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-300"
                                            >
                                                {track.language_name}
                                                {track.is_forced ? ' (Forced)' : ''}
                                                {track.is_sdh ? ' (SDH)' : ''}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Audio Tracks */}
                            {media.audio_tracks && media.audio_tracks.length > 1 && (
                                <div className="mt-4 pt-4 border-t border-gray-700">
                                    <p className="text-gray-500 mb-2">Audio Tracks</p>
                                    <div className="flex flex-wrap gap-2">
                                        {media.audio_tracks.map((track, i) => (
                                            <span
                                                key={i}
                                                className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-300"
                                            >
                                                {track.language_name || 'Unknown'} ({track.codec.toUpperCase()}, {track.channels}ch)
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
