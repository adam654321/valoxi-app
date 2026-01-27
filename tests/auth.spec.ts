import { test, expect } from '@playwright/test';

const TEST_EMAIL = 'e2etest@test.com';
const TEST_PASSWORD = 'testpass123';

test.describe('Authentication Flow', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('should login with valid credentials and redirect to dashboard', async ({ page }) => {
    await page.goto('/login');
    
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel(/password/i).fill(TEST_PASSWORD);
    
    await page.getByRole('button', { name: /sign in/i }).click();
    
    await page.waitForURL(/\/(dashboard)?$/, { timeout: 30000 });
    
    await expect(page).toHaveURL(/\/(dashboard)?$/);
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');
    
    await page.getByLabel(/email/i).fill('wrong@example.com');
    await page.getByLabel(/password/i).fill('wrongpassword');
    
    await page.getByRole('button', { name: /sign in/i }).click();
    
    await expect(page.getByText(/error/i).first()).toBeVisible({ timeout: 10000 });
    
    await expect(page).toHaveURL(/login/);
  });

  test('should logout successfully', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel(/password/i).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/(dashboard)?$/, { timeout: 30000 });
    
    const userMenu = page.getByRole('button', { name: /E2E Test|user|profile/i });
    await userMenu.click();
    
    await page.getByTestId('menu-item-logout').click();
    
    await page.waitForURL(/\/(login)?$/, { timeout: 10000 });
    
    await expect(page).toHaveURL(/\/(login)?$/);
  });
});
