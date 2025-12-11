import MediaCard from './MediaCard';
import type { Media } from '../types';

interface MediaGridProps {
    media: Media[];
    loading?: boolean;
    emptyMessage?: string;
}

export default function MediaGrid({ media, loading = false, emptyMessage = 'No media found' }: MediaGridProps) {
    if (loading) {
        return (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {Array.from({ length: 12 }).map((_, i) => (
                    <div
                        key={i}
                        className="aspect-2/3 rounded-md skeleton"
                    />
                ))}
            </div>
        );
    }

    if (media.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <svg
                    className="w-16 h-16 mb-4 opacity-50"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
                    />
                </svg>
                <p className="text-lg">{emptyMessage}</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {media.map((item, index) => (
                <div
                    key={item.id}
                    className="animate-fadeInUp opacity-0"
                    style={{ animationDelay: `${Math.min(index * 0.05, 0.4)}s`, animationFillMode: 'forwards' }}
                >
                    <MediaCard media={item} />
                </div>
            ))}
        </div>
    );
}
