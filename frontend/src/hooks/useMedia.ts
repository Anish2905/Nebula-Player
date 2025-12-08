import { useState, useEffect, useCallback } from 'react';
import { mediaApi, playbackApi } from '../api/client';
import type { Media } from '../types';

export function useMedia(params?: {
    page?: number;
    limit?: number;
    type?: string;
    search?: string;
    sort?: string;
    order?: string;
}) {
    const [media, setMedia] = useState<Media[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 50,
        total: 0,
        totalPages: 0,
    });

    const fetchMedia = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await mediaApi.getAll(params);
            setMedia(response.data.data);
            setPagination(response.data.pagination);
        } catch (err) {
            setError('Failed to fetch media');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [params?.page, params?.limit, params?.type, params?.search, params?.sort, params?.order]);

    useEffect(() => {
        fetchMedia();
    }, [fetchMedia]);

    return { media, loading, error, pagination, refetch: fetchMedia };
}

export function useMediaDetails(id: number) {
    const [media, setMedia] = useState<Media | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchMedia = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await mediaApi.getById(id);
            setMedia(response.data);
        } catch (err) {
            setError('Failed to fetch media details');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchMedia();
    }, [fetchMedia]);

    return { media, loading, error, refetch: fetchMedia };
}

export function useContinueWatching(limit = 20) {
    const [media, setMedia] = useState<Media[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchContinueWatching = useCallback(async () => {
        setLoading(true);
        try {
            const response = await playbackApi.getContinueWatching(limit);
            setMedia(response.data.data);
        } catch (err) {
            setError('Failed to fetch continue watching');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [limit]);

    useEffect(() => {
        fetchContinueWatching();
    }, [fetchContinueWatching]);

    return { media, loading, error, refetch: fetchContinueWatching };
}

export function useGenres() {
    const [genres, setGenres] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        mediaApi.getGenres()
            .then(response => setGenres(response.data.genres))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    return { genres, loading };
}

export function useYears() {
    const [years, setYears] = useState<number[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        mediaApi.getYears()
            .then(response => setYears(response.data.years))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    return { years, loading };
}
