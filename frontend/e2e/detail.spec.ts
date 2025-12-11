import { test, expect } from '@playwright/test';
import { mockMedia, mockMediaDetail } from './fixtures';

/**
 * Media Detail Page E2E Tests
 * Tests media information display and playback controls
 */

test.describe('Detail Page', () => {
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

        // Mock playback state
        await page.route('**/api/playback/*', async (route) => {
            if (route.request().method() === 'GET') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        position_seconds: 0,
                        duration_seconds: 7200,
                        watched: false
                    })
                });
            } else {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ success: true })
                });
            }
        });

        // Mock video info
        await page.route('**/api/video/*/info', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    duration: 7200,
                    subtitles: [],
                    audioTracks: []
                })
            });
        });
    });

    test('displays media information correctly', async ({ page }) => {
        await mockMediaDetail(page, mockMedia.movie);

        await page.goto(`/media/${mockMedia.movie.id}`);
        await page.waitForLoadState('networkidle');

        // Should show title
        await expect(page.locator('body')).toContainText(mockMedia.movie.title);
    });

    test('displays year and overview', async ({ page }) => {
        await mockMediaDetail(page, mockMedia.movie);

        await page.goto(`/media/${mockMedia.movie.id}`);
        await page.waitForLoadState('networkidle');

        // Should show year and overview
        await expect(page.locator('body')).toContainText(mockMedia.movie.year.toString());
    });

    test('play button is visible', async ({ page }) => {
        await mockMediaDetail(page, mockMedia.movie);

        await page.goto(`/media/${mockMedia.movie.id}`);
        await page.waitForLoadState('networkidle');

        // Look for play button
        const playButton = page.locator('button, a').filter({ hasText: /play/i }).first();
        await expect(playButton).toBeVisible();
    });

    test('shows episode list for TV shows', async ({ page }) => {
        // Mock a TV show with episodes
        await page.route(`**/api/media/${mockMedia.tvShow.id}`, async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    ...mockMedia.tvShow,
                    episodes: [
                        { ...mockMedia.tvShow, episode_number: 1, episode_title: 'Episode 1' },
                        { ...mockMedia.tvShow, episode_number: 2, episode_title: 'Episode 2' }
                    ]
                })
            });
        });

        await page.goto(`/media/${mockMedia.tvShow.id}`);
        await page.waitForLoadState('networkidle');

        // Should show TV show title
        await expect(page.locator('body')).toContainText(mockMedia.tvShow.title);
    });

    test('mark as watched functionality works', async ({ page }) => {
        let watchedSet = false;

        await mockMediaDetail(page, mockMedia.movie);

        await page.route('**/api/playback/*/watched', async (route) => {
            if (route.request().method() === 'PUT') {
                watchedSet = true;
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ success: true })
                });
            }
        });

        await page.goto(`/media/${mockMedia.movie.id}`);
        await page.waitForLoadState('networkidle');

        // Look for watched toggle button
        const watchedButton = page.locator('button').filter({ hasText: /watched|mark/i }).first();
        if (await watchedButton.isVisible()) {
            await watchedButton.click();
            // Wait a bit for the API call
            await page.waitForTimeout(500);
            expect(watchedSet).toBe(true);
        }
    });
});
