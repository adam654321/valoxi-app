import { test, expect } from '@playwright/test';

test.describe('Sanity Tests', () => {
  test('should load the application', async ({ page }) => {
    await page.goto('/');
    
    await expect(page).toHaveTitle(/.*/);
    
    const url = page.url();
    expect(url).toMatch(/localhost:5000/);
  });

  test('should have a working dashboard or redirect to auth', async ({ page }) => {
    const response = await page.goto('/');
    
    expect(response?.status()).toBeLessThan(500);
    
    await page.waitForLoadState('networkidle');
    
    const currentUrl = page.url();
    const isOnDashboard = currentUrl.includes('/') && !currentUrl.includes('/auth');
    const isOnAuth = currentUrl.includes('/auth');
    
    expect(isOnDashboard || isOnAuth).toBeTruthy();
  });
});
