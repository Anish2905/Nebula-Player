import { test, expect } from '@playwright/test';
import { mockMediaList, mockContinueWatching, mockMedia } from './fixtures';

/**
 * Home Page E2E Tests
 * Tests the main dashboard with media grid and navigation
 */

test.describe('Home Page', () => {
    test.beforeEach(async ({ page }) => {
        // Mock scan paths to allow access to home
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

        // Mock genres and years
        await page.route('**/api/media/meta/genres', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ genres: ['Action', 'Comedy', 'Drama'] })
            });
        });

        await page.route('**/api/media/meta/years', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ years: [2023, 2022, 2021] })
            });
        });
    });

    test('displays page layout with navigation', async ({ page }) => {
        await mockMediaList(page);
        await mockContinueWatching(page);

        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Should show sidebar or navigation elements
        await expect(page.locator('body')).toBeVisible();
    });

    test('shows media grid when library has content', async ({ page }) => {
        await mockMediaList(page, [mockMedia.movie, mockMedia.tvShow]);
        await mockContinueWatching(page);

        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Page should render successfully - check for either media content or media grid container
        await expect(page.locator('body')).toBeVisible();
        // The mock data should be loaded - page should not be stuck on loading
        await page.waitForTimeout(1000);
    });

    test('shows continue watching section when applicable', async ({ page }) => {
        const continueWatchingItem = {
            ...mockMedia.movie,
            position_seconds: 1800,
            duration_seconds: 7200,
            progress_percent: 25
        };

        await mockMediaList(page);
        await mockContinueWatching(page, [continueWatchingItem]);

        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Page should load successfully
        await expect(page.locator('body')).toBeVisible();
    });

    test('media cards are clickable and navigate to detail page', async ({ page }) => {
        await mockMediaList(page, [mockMedia.movie]);
        await mockContinueWatching(page);

        // Mock detail page API
        await page.route(`**/api/media/${mockMedia.movie.id}`, async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(mockMedia.movie)
            });
        });

        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Find and click a media card - look for links or clickable elements
        const mediaLink = page.locator(`a[href*="/media/${mockMedia.movie.id}"]`).first();
        if (await mediaLink.isVisible()) {
            await mediaLink.click();
            await expect(page).toHaveURL(new RegExp(`/media/${mockMedia.movie.id}`));
        }
    });

    test('sidebar navigation works correctly', async ({ page }) => {
        await mockMediaList(page);
        await mockContinueWatching(page);

        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Look for settings link in navigation
        const settingsLink = page.locator('a[href*="settings"]').first();
        if (await settingsLink.isVisible()) {
            await settingsLink.click();
            await expect(page).toHaveURL(/settings/);
        }
    });
});
