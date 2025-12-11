import { Link } from 'react-router-dom';
import { Play } from 'lucide-react';
import type { Media } from '../types';

interface MediaCardProps {
    media: Media;
    showProgress?: boolean;
}

export default function MediaCard({ media, showProgress = true }: MediaCardProps) {
    const progress = media.playback_state?.progress_percent || 0;
    const hasProgress = showProgress && progress > 1 && progress < 95;

    // Parse genres if it's a JSON string
    let genres: string[] = [];
    if (media.genres) {
        try {
            genres = JSON.parse(media.genres);
        } catch {
            genres = [];
        }
    }

    return (
        <Link
            to={`/media/${media.id}`}
            className="media-card relative block aspect-2/3 rounded-md overflow-hidden bg-(--bg-card) group"
        >
            {/* Poster Image */}
            {media.poster_path ? (
                <img
                    src={media.poster_path}
                    alt={media.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                />
            ) : (
                <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-gray-800 to-gray-900">
                    <span className="text-gray-400 text-sm text-center px-2">
                        {media.title}
                    </span>
                </div>
            )}

            {/* Hover Overlay */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
                {/* Play Button */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center">
                        <Play className="w-6 h-6 text-black ml-1" fill="black" />
                    </div>
                </div>

                {/* Info */}
                <div className="relative z-10">
                    <h3 className="text-white font-semibold text-sm truncate">
                        {media.title}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-gray-300 mt-1">
                        {media.year && <span>{media.year}</span>}
                        {media.rating && (
                            <span className="text-green-400">★ {media.rating.toFixed(1)}</span>
                        )}
                        {media.resolution && (
                            <span className="bg-gray-600 px-1.5 py-0.5 rounded text-[10px]">
                                {media.resolution}
                            </span>
                        )}
                    </div>
                    {genres.length > 0 && (
                        <p className="text-xs text-gray-400 mt-1 truncate">
                            {genres.slice(0, 2).join(' • ')}
                        </p>
                    )}
                </div>
            </div>

            {/* TV Episode Badge */}
            {media.media_type === 'tv' && media.season_number && media.episode_number && (
                <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                    S{media.season_number}E{media.episode_number}
                </div>
            )}

            {/* Transcoding Badge (for non-browser-native formats) */}
            {media.browser_compatible === 0 && (
                <div className="absolute top-2 right-2 bg-blue-600/80 text-white text-[10px] px-1.5 py-0.5 rounded" title="Will be transcoded for playback">
                    🔄
                </div>
            )}

            {/* Progress Bar */}
            {hasProgress && (
                <div className="progress-overlay">
                    <div
                        className="progress-bar"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            )}
        </Link>
    );
}
