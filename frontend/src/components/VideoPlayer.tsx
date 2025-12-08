import { useEffect, useRef, useCallback, useState } from 'react';
import { playbackApi, videoApi } from '../api/client';
import type { Media } from '../types';

interface VideoPlayerProps {
    media: Media;
    onClose?: () => void;
    autoPlay?: boolean;
}

export default function VideoPlayer({ media, onClose, autoPlay = true }: VideoPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const saveIntervalRef = useRef<number | null>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(media.duration_seconds || 0);
    const [isPlaying, setIsPlaying] = useState(false);

    // Format time as HH:MM:SS
    const formatTime = (seconds: number): string => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0) {
            return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // Save playback position
    const savePosition = useCallback(async (position: number, videoDuration: number) => {
        if (position > 5) {
            try {
                await playbackApi.savePosition(media.id, Math.round(position), Math.round(videoDuration));
            } catch (err) {
                console.error('Failed to save position:', err);
            }
        }
    }, [media.id]);

    // Initialize video
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        // Load saved position
        const loadPosition = async () => {
            try {
                const response = await playbackApi.getState(media.id);
                const savedPosition = response.data?.position_seconds || 0;
                if (savedPosition > 5 && savedPosition < (video.duration || 999999) - 10) {
                    video.currentTime = savedPosition;
                }
            } catch (err) {
                console.error('Failed to get saved position:', err);
            }
        };

        video.addEventListener('loadedmetadata', () => {
            setDuration(video.duration || 0);
            loadPosition();
        });

        video.addEventListener('timeupdate', () => {
            setCurrentTime(video.currentTime || 0);
        });

        video.addEventListener('play', () => setIsPlaying(true));
        video.addEventListener('pause', () => setIsPlaying(false));

        video.addEventListener('ended', () => {
            savePosition(video.duration, video.duration);
        });

        // Auto-save every 10 seconds
        saveIntervalRef.current = window.setInterval(() => {
            if (video.currentTime > 0 && video.duration > 0) {
                savePosition(video.currentTime, video.duration);
            }
        }, 10000);

        // Start playing if autoPlay
        if (autoPlay) {
            video.play().catch(console.error);
        }

        return () => {
            if (saveIntervalRef.current) {
                clearInterval(saveIntervalRef.current);
            }
            if (video.currentTime > 0) {
                savePosition(video.currentTime, video.duration);
            }
        };
    }, [media.id, autoPlay, savePosition]);

    // Keyboard shortcuts
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            switch (e.key) {
                case ' ':
                case 'k':
                    e.preventDefault();
                    video.paused ? video.play() : video.pause();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    video.currentTime = Math.max(0, video.currentTime - 10);
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    video.volume = Math.min(1, video.volume + 0.1);
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    video.volume = Math.max(0, video.volume - 0.1);
                    break;
                case 'f':
                    e.preventDefault();
                    if (document.fullscreenElement) {
                        document.exitFullscreen();
                    } else {
                        video.requestFullscreen();
                    }
                    break;
                case 'm':
                    e.preventDefault();
                    video.muted = !video.muted;
                    break;
                case 'Escape':
                    if (onClose) onClose();
                    break;
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    return (
        <div className="relative w-full h-full bg-black flex items-center justify-center">
            {/* Native HTML5 Video */}
            <video
                ref={videoRef}
                src={videoApi.getStreamUrl(media.id)}
                controls
                autoPlay={autoPlay}
                playsInline
                className="w-full h-full object-contain"
                style={{ maxHeight: '100vh' }}
            />

            {/* Custom Overlay */}
            <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none">
                <div className="text-white bg-black/50 p-2 rounded">
                    <h2 className="text-xl font-semibold">{media.title}</h2>
                    {media.media_type === 'tv' && media.season_number && media.episode_number && (
                        <p className="text-sm text-gray-300">
                            S{media.season_number} E{media.episode_number}
                            {media.episode_title && ` - ${media.episode_title}`}
                        </p>
                    )}
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="pointer-events-auto text-white/80 hover:text-white p-2 bg-black/50 rounded-full"
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}
            </div>

            {/* Time Display */}
            <div className="absolute bottom-20 left-4 text-white text-sm pointer-events-none bg-black/50 px-2 py-1 rounded">
                {formatTime(currentTime)} / {formatTime(duration)}
            </div>
        </div>
    );
}
