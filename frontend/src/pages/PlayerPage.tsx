import { useParams, useNavigate } from 'react-router-dom';
import VideoPlayer from '../components/VideoPlayer';
import { useMediaDetails, useMedia } from '../hooks/useMedia';
import { useMemo } from 'react';

export default function PlayerPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { media, loading, error } = useMediaDetails(parseInt(id!));

    // Fetch siblings if TV show to find next episode
    const siblingsParams = useMemo(() => ({
        tmdb_id: media?.media_type === 'tv' && media.tmdb_id ? media.tmdb_id : undefined,
        type: 'tv',
        limit: 1000,
        sort: 'season_number,episode_number',
    }), [media?.media_type, media?.tmdb_id]);

    const { media: siblings } = useMedia(siblingsParams);

    const nextEpisode = useMemo(() => {
        if (!media || media.media_type !== 'tv' || !siblings.length) return null;

        // Sort siblings just in case API didn't
        const sorted = [...siblings].sort((a, b) => {
            const sA = a.season_number || 0;
            const sB = b.season_number || 0;
            if (sA !== sB) return sA - sB;
            return (a.episode_number || 0) - (b.episode_number || 0);
        });

        const currentIndex = sorted.findIndex(m => m.id === media.id);
        if (currentIndex !== -1 && currentIndex < sorted.length - 1) {
            return sorted[currentIndex + 1];
        }
        return null;
    }, [media, siblings]);

    const handleClose = () => {
        navigate(-1);
    };

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-t-(--accent) border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (error || !media) {
        return (
            <div className="fixed inset-0 bg-black flex flex-col items-center justify-center text-white">
                <p className="text-xl mb-4">Failed to load video</p>
                <button onClick={handleClose} className="btn-primary">
                    Go Back
                </button>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black z-50">
            <VideoPlayer
                media={media}
                nextEpisode={nextEpisode}
                onClose={handleClose}
            />
        </div>
    );
}
