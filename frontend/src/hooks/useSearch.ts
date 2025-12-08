import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { searchApi } from '../api/client';
import type { Media, SearchParams } from '../types';

export function useSearch() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [results, setResults] = useState<Media[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 50,
        total: 0,
        totalPages: 0,
    });

    const filters = useMemo((): SearchParams => ({
        q: searchParams.get('q') || undefined,
        genre: searchParams.get('genre') || undefined,
        year: searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined,
        resolution: searchParams.get('resolution') || undefined,
        type: searchParams.get('type') || undefined,
        sort: searchParams.get('sort') || 'rating',
        order: searchParams.get('order') || 'DESC',
        page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
        limit: 50,
    }), [searchParams]);

    const updateFilters = useCallback((newFilters: SearchParams) => {
        const params = new URLSearchParams();
        Object.entries(newFilters).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                params.set(key, String(value));
            }
        });
        setSearchParams(params);
    }, [setSearchParams]);

    const search = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await searchApi.search(filters);
            setResults(response.data.data);
            setPagination(response.data.pagination);
        } catch (err) {
            setError('Search failed');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        const debounce = setTimeout(() => {
            search();
        }, 300);
        return () => clearTimeout(debounce);
    }, [search]);

    return {
        results,
        loading,
        error,
        pagination,
        filters,
        updateFilters,
        search,
    };
}

export function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => clearTimeout(timer);
    }, [value, delay]);

    return debouncedValue;
}
