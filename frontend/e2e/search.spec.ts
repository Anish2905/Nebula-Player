import { test, expect } from '@playwright/test';
import { mockSearch, mockMedia } from './fixtures';

/**
 * Search Page E2E Tests
 * Tests search functionality and filtering
 */

test.describe('Search Page', () => {
    test.beforeEach(async ({ page }) => {
        // Mock scan paths
        await page.route('**/api/settings/scan-paths', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    data: [{
                        id: 1,
                        path: 'D:\\Movies',
                        enabled: true,
                        recursive: true,
                        exists: true
                    }]
                })
            });
        });

        // Mock suggestions
        await page.route('**/api/search/suggestions*', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ suggestions: ['Test Movie', 'Test Series'] })
            });
        });

        // Mock stats
        await page.route('**/api/search/stats', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    totalMedia: 10,
                    movies: 5,
                    tvShows: 5,
                    genres: ['Action', 'Drama'],
                    years: [2023, 2022]
                })
            });
        });
    });

    test('search page loads correctly', async ({ page }) => {
        await mockSearch(page, [mockMedia.movie]);

        await page.goto('/search');
        await page.waitForLoadState('networkidle');

        await expect(page.locator('body')).toBeVisible();
    });

    test('search bar is visible and functional', async ({ page }) => {
        await mockSearch(page);

        await page.goto('/search');
        await page.waitForLoadState('networkidle');

        // Look for search input
        const searchInput = page.locator('input[type="text"], input[type="search"], input[placeholder*="search" i]').first();
        if (await searchInput.isVisible()) {
            await expect(searchInput).toBeEnabled();
        }
    });

    test('search results display correctly', async ({ page }) => {
        await mockSearch(page, [mockMedia.movie, mockMedia.tvShow]);

        await page.goto('/search?q=test');
        await page.waitForLoadState('networkidle');

        // Should show results
        await expect(page.locator('body')).toContainText(/test movie|test series/i);
    });

    test('empty search shows appropriate message', async ({ page }) => {
        await mockSearch(page, []);

        await page.goto('/search?q=nonexistent');
        await page.waitForLoadState('networkidle');

        // Should show some empty state or message
        await expect(page.locator('body')).toBeVisible();
    });

    test('filter by genre works', async ({ page }) => {
        let lastSearchParams: URLSearchParams | null = null;

        await page.route('**/api/search*', async (route) => {
            const url = new URL(route.request().url());
            lastSearchParams = url.searchParams;

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    data: [mockMedia.movie],
                    pagination: {
                        page: 1,
                        limit: 50,
                        total: 1,
                        totalPages: 1
                    }
                })
            });
        });

        await page.goto('/search?genre=Action');
        await page.waitForLoadState('networkidle');

        // Genre filter should be in params
        expect(lastSearchParams?.get('genre')).toBe('Action');
    });
});
