import { test as base, expect } from '@playwright/test';

/**
 * Custom test fixtures for Nebula Player E2E tests
 */

// Test fixture that ensures we have scan paths configured
export const test = base.extend<{
    setupLibrary: void;
}>({
    setupLibrary: [async ({ page }, use) => {
        // Mock the scan paths API to return at least one path
        // This ensures the app doesn't redirect to /welcome
        await page.route('**/api/settings/scan-paths', async (route) => {
            if (route.request().method() === 'GET') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        data: [{
                            id: 1,
                            path: 'D:\\Test\\Movies',
                            enabled: true,
                            recursive: true,
                            last_scan_at: new Date().toISOString(),
                            exists: true
                        }]
                    })
                });
            } else {
                await route.continue();
            }
        });

        await use();
    }, { auto: false }]
});

// Export expect for convenience
export { expect };

/**
 * Mock media data for testing
 */
export const mockMedia = {
    movie: {
        id: 1,
        title: 'Test Movie',
        media_type: 'movie',
        year: 2023,
        overview: 'A test movie for E2E testing purposes.',
        poster_path: '/test-poster.jpg',
        backdrop_path: '/test-backdrop.jpg',
        vote_average: 8.5,
        genres: 'Action, Adventure',
        runtime: 120,
        file_path: 'D:\\Test\\Movies\\test-movie.mp4',
        resolution: '1080p',
        codec: 'h264',
        compatible: true
    },
    tvShow: {
        id: 2,
        title: 'Test Series',
        media_type: 'tv',
        year: 2023,
        overview: 'A test TV series for E2E testing.',
        poster_path: '/test-series-poster.jpg',
        backdrop_path: '/test-series-backdrop.jpg',
        vote_average: 9.0,
        genres: 'Drama, Thriller',
        season_number: 1,
        episode_number: 1,
        episode_title: 'Pilot',
        file_path: 'D:\\Test\\Series\\S01E01.mp4',
        resolution: '4K',
        codec: 'hevc',
        compatible: false
    }
};

/**
 * Helper to mock media list API
 */
export async function mockMediaList(page: import('@playwright/test').Page, mediaItems = [mockMedia.movie, mockMedia.tvShow]) {
    await page.route('**/api/media', async (route) => {
        if (route.request().method() === 'GET') {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    data: mediaItems,
                    pagination: {
                        page: 1,
                        limit: 50,
                        total: mediaItems.length,
                        totalPages: 1
                    }
                })
            });
        } else {
            await route.continue();
        }
    });
}

/**
 * Helper to mock single media API
 */
export async function mockMediaDetail(page: import('@playwright/test').Page, media = mockMedia.movie) {
    await page.route(`**/api/media/${media.id}`, async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(media)
        });
    });
}

/**
 * Helper to mock continue watching API
 */
export async function mockContinueWatching(page: import('@playwright/test').Page, items: typeof mockMedia.movie[] = []) {
    await page.route('**/api/playback/continue*', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: items })
        });
    });
}

/**
 * Helper to mock search API
 */
export async function mockSearch(page: import('@playwright/test').Page, results = [mockMedia.movie]) {
    await page.route('**/api/search*', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                data: results,
                pagination: {
                    page: 1,
                    limit: 50,
                    total: results.length,
                    totalPages: 1
                }
            })
        });
    });
}
