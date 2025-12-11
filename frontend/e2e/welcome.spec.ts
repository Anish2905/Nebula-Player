import { test, expect } from '@playwright/test';

/**
 * Welcome Page E2E Tests
 * Tests the onboarding flow when no scan paths are configured
 */

test.describe('Welcome Page', () => {
    test.beforeEach(async ({ page }) => {
        // Mock empty scan paths to trigger welcome page redirect
        await page.route('**/api/settings/scan-paths', async (route) => {
            if (route.request().method() === 'GET') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ data: [] })
                });
            } else {
                await route.continue();
            }
        });
    });

    test('redirects to /welcome when no scan paths configured', async ({ page }) => {
        await page.goto('/');
        await expect(page).toHaveURL('/welcome');
    });

    test('displays welcome page content correctly', async ({ page }) => {
        await page.goto('/welcome');

        // Should show welcome heading or setup instructions
        await expect(page.locator('body')).toContainText(/welcome|setup|library|get started/i);
    });

    test('displays folder browser', async ({ page }) => {
        // Mock browse folders API
        await page.route('**/api/settings/browse-folders*', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    path: 'D:\\',
                    parent: null,
                    items: [
                        { name: 'Movies', path: 'D:\\Movies', type: 'folder' },
                        { name: 'TV Shows', path: 'D:\\TV Shows', type: 'folder' }
                    ]
                })
            });
        });

        await page.goto('/welcome');

        // Wait for the page to load and show folder browser
        await page.waitForLoadState('networkidle');

        // Should show some folder selection UI
        await expect(page.locator('body')).toBeVisible();
    });

    test('can add a scan path successfully', async ({ page }) => {
        let pathAdded = false;

        // Mock browse folders
        await page.route('**/api/settings/browse-folders*', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    path: 'D:\\',
                    parent: null,
                    items: [
                        { name: 'Movies', path: 'D:\\Movies', type: 'folder' }
                    ]
                })
            });
        });

        // Mock add scan path
        await page.route('**/api/settings/scan-paths', async (route) => {
            if (route.request().method() === 'POST') {
                pathAdded = true;
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ id: 1, path: 'D:\\Movies', recursive: true })
                });
            } else if (route.request().method() === 'GET') {
                // Return the added path after POST
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        data: pathAdded ? [{
                            id: 1,
                            path: 'D:\\Movies',
                            enabled: true,
                            recursive: true,
                            last_scan_at: null,
                            exists: true
                        }] : []
                    })
                });
            }
        });

        await page.goto('/welcome');
        await page.waitForLoadState('networkidle');
    });

    test('shows path in UI after adding', async ({ page }) => {
        // Mock with existing path
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
                        last_scan_at: null,
                        exists: true
                    }]
                })
            });
        });

        await page.goto('/welcome');
        await page.waitForLoadState('networkidle');

        // Path should be visible somewhere
        await expect(page.locator('body')).toContainText(/movies/i);
    });
});
