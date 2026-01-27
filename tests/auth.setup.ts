import { test as setup, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const authFile = path.join(__dirname, '.auth/user.json');

const TEST_EMAIL = 'e2etest@test.com';
const TEST_PASSWORD = 'testpass123';

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  
  await page.waitForLoadState('networkidle');
  
  await page.getByLabel(/email/i).fill(TEST_EMAIL);
  await page.getByLabel(/password/i).fill(TEST_PASSWORD);
  
  await page.getByRole('button', { name: /sign in/i }).click();
  
  await page.waitForURL(/\/(dashboard)?$/, { timeout: 30000 });
  
  await expect(page).toHaveURL(/\/(dashboard)?$/);
  
  await page.context().storageState({ path: authFile });
});
