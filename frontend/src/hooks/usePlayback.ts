import { useState, useCallback } from 'react';
import { playbackApi } from '../api/client';

export function usePlayback(mediaId: number) {
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const savePosition = useCallback(async (position: number, duration: number) => {
        setSaving(true);
        setError(null);
        try {
            await playbackApi.savePosition(mediaId, position, duration);
        } catch (err) {
            setError('Failed to save playback position');
            console.error(err);
        } finally {
            setSaving(false);
        }
    }, [mediaId]);

    const setWatched = useCallback(async (watched: boolean) => {
        setSaving(true);
        setError(null);
        try {
            await playbackApi.setWatched(mediaId, watched);
        } catch (err) {
            setError('Failed to update watched status');
            console.error(err);
        } finally {
            setSaving(false);
        }
    }, [mediaId]);

    return { savePosition, setWatched, saving, error };
}
