/**
 * API Client - Axios wrapper for backend communication
 */

import axios from 'axios';

const api = axios.create({
    baseURL: '/api',
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Response interceptor for error handling
api.interceptors.response.use(
    (response) => response,
    (error) => {
        console.error('API Error:', error.response?.data || error.message);
        throw error;
    }
);

// Media API
export const mediaApi = {
    getAll: (params?: {
        page?: number;
        limit?: number;
        type?: string;
        search?: string;
        sort?: string;
        order?: string;
        tmdb_id?: number;
        group_by_series?: boolean;
    }) => api.get('/media', { params }),

    getById: (id: number) => api.get(`/media/${id}`),

    scan: (path?: string, enrich = true) =>
        api.post('/media/scan', { path, enrich }),

    enrich: (id: number) => api.post(`/media/${id}/enrich`),

    delete: (id: number) => api.delete(`/media/${id}`),

    getGenres: () => api.get('/media/meta/genres'),

    getYears: () => api.get('/media/meta/years'),
};

// Playback API
export const playbackApi = {
    getState: (id: number) => api.get(`/playback/${id}`),

    savePosition: (id: number, position_seconds: number, duration_seconds: number) =>
        api.post(`/playback/${id}`, { position_seconds, duration_seconds }),

    setWatched: (id: number, watched: boolean) =>
        api.put(`/playback/${id}/watched`, { watched }),

    getContinueWatching: (limit = 20) =>
        api.get('/playback/continue', { params: { limit } }),

    getRecentlyWatched: (limit = 20) =>
        api.get('/playback/recently-watched', { params: { limit } }),
};

// Search API
export const searchApi = {
    search: (params: {
        q?: string;
        genre?: string;
        year?: number;
        yearFrom?: number;
        yearTo?: number;
        resolution?: string;
        type?: string;
        compatible?: boolean;
        sort?: string;
        order?: string;
        page?: number;
        limit?: number;
    }) => api.get('/search', { params }),

    getSuggestions: (q: string) =>
        api.get('/search/suggestions', { params: { q } }),

    getStats: () => api.get('/search/stats'),
};

// Settings API
export const settingsApi = {
    getAll: () => api.get('/settings'),

    update: (settings: Record<string, unknown>) => api.put('/settings', settings),

    getScanPaths: () => api.get('/settings/scan-paths'),

    addScanPath: (path: string, recursive = true) =>
        api.post('/settings/scan-paths', { path, recursive }),

    updateScanPath: (id: number, data: { enabled?: boolean; recursive?: boolean }) =>
        api.put(`/settings/scan-paths/${id}`, data),

    deleteScanPath: (id: number) => api.delete(`/settings/scan-paths/${id}`),

    browseFolders: (path?: string) =>
        api.get('/settings/browse-folders', { params: { path } }),

    clearHistory: () => api.post('/settings/clear-history'),

    clearTmdbCache: () => api.post('/settings/clear-tmdb-cache'),

    getScanErrors: (limit = 50) =>
        api.get('/settings/scan-errors', { params: { limit } }),
};

// Video API
export const videoApi = {
    getStreamUrl: (id: number, seekTime?: number) => {
        if (seekTime && seekTime > 0) {
            return `/api/video/${id}?t=${seekTime}`;
        }
        return `/api/video/${id}`;
    },

    getSubtitleUrl: (mediaId: number, trackId: number) =>
        `/api/video/${mediaId}/subtitle/${trackId}`,

    getInfo: (id: number) => api.get(`/video/${id}/info`),
};

export default api;
