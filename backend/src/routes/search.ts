/**
 * Search Routes - Search and filter media
 */

import { Router } from 'express';
import { getAll, getOne } from '../db.js';

const router = Router();

// GET /api/search - Search with filters
router.get('/', (req, res) => {
    try {
        const {
            q,
            genre,
            year,
            yearFrom,
            yearTo,
            resolution,
            type,
            compatible,
            sort = 'rating',
            order = 'DESC',
            page = '1',
            limit = '50',
        } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const offset = (pageNum - 1) * limitNum;

        const conditions: string[] = [];
        const params: unknown[] = [];

        // Full-text search on title, overview, cast, director
        if (q) {
            conditions.push(`(
        title LIKE ? OR 
        overview LIKE ? OR 
        cast_members LIKE ? OR 
        director LIKE ?
      )`);
            const searchTerm = `%${q}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        // Genre filter (genres is stored as JSON array)
        if (genre) {
            conditions.push('genres LIKE ?');
            params.push(`%"${genre}"%`);
        }

        // Year filters
        if (year) {
            conditions.push('year = ?');
            params.push(parseInt(year as string));
        }
        if (yearFrom) {
            conditions.push('year >= ?');
            params.push(parseInt(yearFrom as string));
        }
        if (yearTo) {
            conditions.push('year <= ?');
            params.push(parseInt(yearTo as string));
        }

        // Resolution filter
        if (resolution) {
            conditions.push('resolution = ?');
            params.push(resolution);
        }

        // Media type filter
        if (type && type !== 'all') {
            conditions.push('media_type = ?');
            params.push(type);
        }

        // Browser compatible filter
        if (compatible === 'true') {
            conditions.push('browser_compatible = 1');
        }

        const whereClause = conditions.length > 0
            ? 'WHERE ' + conditions.join(' AND ')
            : '';

        // Validate sort column
        const validSorts = ['title', 'year', 'added_at', 'rating', 'release_date', 'runtime'];
        const sortColumn = validSorts.includes(sort as string) ? sort : 'rating';
        const sortOrder = (order as string).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        // Get total count
        const countResult = getOne<{ count: number }>(
            `SELECT COUNT(*) as count FROM media ${whereClause}`,
            params
        );
        const total = countResult?.count || 0;

        // Get results
        const results = getAll<unknown>(
            `SELECT 
        id, title, year, media_type, poster_path, backdrop_path,
        season_number, episode_number, episode_title,
        overview, genres, rating, vote_count, runtime, resolution,
        browser_compatible, has_subtitles, duration_seconds, added_at
      FROM media 
      ${whereClause}
      ORDER BY ${sortColumn} ${sortOrder} NULLS LAST
      LIMIT ? OFFSET ?`,
            [...params, limitNum, offset]
        );

        res.json({
            data: results,
            query: {
                q,
                genre,
                year,
                yearFrom,
                yearTo,
                resolution,
                type,
                compatible,
                sort: sortColumn,
                order: sortOrder,
            },
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
            },
        });
    } catch (err) {
        console.error('Search error:', err);
        res.status(500).json({ error: 'Search failed' });
    }
});

// GET /api/search/suggestions - Get search suggestions based on partial query
router.get('/suggestions', (req, res) => {
    try {
        const q = req.query.q as string;

        if (!q || q.length < 2) {
            return res.json({ suggestions: [] });
        }

        // Get title suggestions
        const titles = getAll<{ title: string }>(
            `SELECT DISTINCT title FROM media 
       WHERE title LIKE ? 
       ORDER BY rating DESC NULLS LAST
       LIMIT 10`,
            [`%${q}%`]
        );

        // Get director suggestions
        const directors = getAll<{ director: string }>(
            `SELECT DISTINCT director FROM media 
       WHERE director LIKE ? AND director IS NOT NULL
       LIMIT 5`,
            [`%${q}%`]
        );

        res.json({
            suggestions: {
                titles: titles.map(t => t.title),
                directors: directors.map(d => d.director),
            },
        });
    } catch (err) {
        console.error('Suggestions error:', err);
        res.status(500).json({ error: 'Failed to get suggestions' });
    }
});

// GET /api/search/stats - Get library statistics
router.get('/stats', (req, res) => {
    try {
        const stats = getOne<{
            total: number;
            movies: number;
            tv: number;
            watched: number;
            total_duration: number;
        }>(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN media_type = 'movie' THEN 1 ELSE 0 END) as movies,
        SUM(CASE WHEN media_type = 'tv' THEN 1 ELSE 0 END) as tv,
        (SELECT COUNT(*) FROM playback_state WHERE completed = 1) as watched,
        SUM(duration_seconds) as total_duration
      FROM media
    `);

        // Get genre distribution
        const genres = getAll<{ genres: string }>('SELECT genres FROM media WHERE genres IS NOT NULL');
        const genreCounts: Record<string, number> = {};

        for (const row of genres) {
            try {
                const parsed = JSON.parse(row.genres);
                for (const genre of parsed) {
                    genreCounts[genre] = (genreCounts[genre] || 0) + 1;
                }
            } catch { }
        }

        // Get resolution distribution
        const resolutions = getAll<{ resolution: string; count: number }>(`
      SELECT resolution, COUNT(*) as count 
      FROM media 
      WHERE resolution IS NOT NULL 
      GROUP BY resolution
      ORDER BY count DESC
    `);

        res.json({
            totalMedia: stats?.total || 0,
            movies: stats?.movies || 0,
            tvEpisodes: stats?.tv || 0,
            watched: stats?.watched || 0,
            totalDuration: stats?.total_duration || 0,
            genreDistribution: genreCounts,
            resolutionDistribution: resolutions,
        });
    } catch (err) {
        console.error('Stats error:', err);
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

export default router;
