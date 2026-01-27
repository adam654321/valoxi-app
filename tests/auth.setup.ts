import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '.auth/user.json');

setup('authenticate', async ({ page }) => {
  await page.goto('/auth');
  
  await page.waitForLoadState('networkidle');
  
  await page.getByLabel(/email/i).fill('adam@example.com');
  await page.getByLabel(/password/i).fill('password123');
  
  await page.getByRole('button', { name: /sign in|log in|login/i }).click();
  
  await page.waitForURL('/', { timeout: 30000 });
  
  await expect(page).toHaveURL('/');
  
  await page.context().storageState({ path: authFile });
});
