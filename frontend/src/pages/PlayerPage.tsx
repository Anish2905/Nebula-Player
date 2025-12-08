import { useParams, useNavigate } from 'react-router-dom';
import VideoPlayer from '../components/VideoPlayer';
import { useMediaDetails } from '../hooks/useMedia';

export default function PlayerPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { media, loading, error } = useMediaDetails(parseInt(id!));

    const handleClose = () => {
        navigate(-1);
    };

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-t-[var(--accent)] border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin" />
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
            <VideoPlayer media={media} onClose={handleClose} />
        </div>
    );
}
