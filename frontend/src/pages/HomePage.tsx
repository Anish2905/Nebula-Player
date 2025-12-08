import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Play, Settings, RefreshCw } from 'lucide-react';
import MediaGrid from '../components/MediaGrid';
import ContinueWatching from '../components/ContinueWatching';
import SearchBar from '../components/SearchBar';
import { useMedia, useContinueWatching } from '../hooks/useMedia';
import { mediaApi } from '../api/client';
import type { Media } from '../types';

export default function HomePage() {
    const { media, loading, refetch } = useMedia({ sort: 'added_at', order: 'DESC', limit: 50 });
    const { media: continueWatching, loading: cwLoading } = useContinueWatching();
    const [scanning, setScanning] = useState(false);
    const [heroMedia, setHeroMedia] = useState<Media | null>(null);

    // Pick a random featured item for hero
    useEffect(() => {
        if (media.length > 0) {
            const withBackdrop = media.filter(m => m.backdrop_path);
            if (withBackdrop.length > 0) {
                setHeroMedia(withBackdrop[Math.floor(Math.random() * withBackdrop.length)]);
            } else {
                setHeroMedia(media[0]);
            }
        }
    }, [media]);

    const handleScan = async () => {
        setScanning(true);
        try {
            await mediaApi.scan();
            await refetch();
        } catch (err) {
            console.error('Scan failed:', err);
        } finally {
            setScanning(false);
        }
    };

    return (
        <div className="min-h-screen">
            {/* Hero Section */}
            {heroMedia && (
                <div className="relative h-[60vh] min-h-[400px]">
                    {/* Backdrop Image */}
                    <div className="absolute inset-0">
                        {heroMedia.backdrop_path ? (
                            <img
                                src={heroMedia.backdrop_path}
                                alt={heroMedia.title}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900" />
                        )}
                        <div className="gradient-overlay absolute inset-0" />
                    </div>

                    {/* Hero Content */}
                    <div className="relative h-full flex flex-col justify-end p-8 max-w-4xl">
                        <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">
                            {heroMedia.title}
                        </h1>
                        {heroMedia.tagline && (
                            <p className="text-lg text-gray-300 italic mb-3">{heroMedia.tagline}</p>
                        )}
                        <p className="text-gray-200 line-clamp-3 mb-4 max-w-2xl">
                            {heroMedia.overview || 'No description available.'}
                        </p>
                        <div className="flex gap-4">
                            <Link
                                to={`/play/${heroMedia.id}`}
                                className="btn-primary"
                            >
                                <Play className="w-5 h-5" fill="white" />
                                Play
                            </Link>
                            <Link
                                to={`/media/${heroMedia.id}`}
                                className="btn-secondary"
                            >
                                More Info
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div className="px-8 py-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <SearchBar />
                    <div className="flex gap-3">
                        <button
                            onClick={handleScan}
                            disabled={scanning}
                            className="btn-secondary text-sm"
                        >
                            <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
                            {scanning ? 'Scanning...' : 'Scan Library'}
                        </button>
                        <Link to="/settings" className="btn-secondary text-sm">
                            <Settings className="w-4 h-4" />
                            Settings
                        </Link>
                    </div>
                </div>

                {/* Continue Watching */}
                {continueWatching.length > 0 && (
                    <section className="mb-10">
                        <h2 className="text-xl font-semibold text-white mb-4">Continue Watching</h2>
                        <ContinueWatching media={continueWatching} loading={cwLoading} />
                    </section>
                )}

                {/* Recently Added */}
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold text-white">Recently Added</h2>
                        <Link
                            to="/search"
                            className="text-sm text-gray-400 hover:text-white transition-colors"
                        >
                            View All →
                        </Link>
                    </div>
                    <MediaGrid
                        media={media}
                        loading={loading}
                        emptyMessage="No media found. Add a library path in Settings and scan your collection."
                    />
                </section>
            </div>
        </div>
    );
}
