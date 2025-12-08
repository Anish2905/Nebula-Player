import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import MediaCard from './MediaCard';
import type { Media } from '../types';

interface ContinueWatchingProps {
    media: Media[];
    loading?: boolean;
}

export default function ContinueWatching({ media, loading = false }: ContinueWatchingProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    const scroll = (direction: 'left' | 'right') => {
        if (!scrollRef.current) return;
        const scrollAmount = scrollRef.current.clientWidth * 0.8;
        scrollRef.current.scrollBy({
            left: direction === 'left' ? -scrollAmount : scrollAmount,
            behavior: 'smooth',
        });
    };

    if (loading) {
        return (
            <div className="relative">
                <div className="scroll-row">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div
                            key={i}
                            className="flex-none w-[180px] aspect-[2/3] rounded-md skeleton"
                        />
                    ))}
                </div>
            </div>
        );
    }

    if (media.length === 0) {
        return null;
    }

    return (
        <div className="relative group">
            {/* Scroll Buttons */}
            <button
                onClick={() => scroll('left')}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-20 bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-black/80"
            >
                <ChevronLeft className="w-6 h-6" />
            </button>
            <button
                onClick={() => scroll('right')}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-20 bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-black/80"
            >
                <ChevronRight className="w-6 h-6" />
            </button>

            {/* Scrollable Row */}
            <div ref={scrollRef} className="scroll-row px-1">
                {media.map((item) => (
                    <div key={item.id} className="flex-none w-[180px]">
                        <MediaCard media={item} showProgress={true} />
                    </div>
                ))}
            </div>
        </div>
    );
}
