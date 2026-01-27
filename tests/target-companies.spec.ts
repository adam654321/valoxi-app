import { test, expect } from '@playwright/test';

test.describe('Target Companies', () => {
  const uniqueCompanyName = `Test Company ${Date.now()}`;

  test('should create a new company and verify it appears in list', async ({ page }) => {
    await page.goto('/target-companies');
    await page.waitForLoadState('networkidle');
    
    await page.getByTestId('button-add-target-company').click();
    
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    
    await page.getByLabel(/company name/i).fill(uniqueCompanyName);
    
    await page.getByRole('combobox').filter({ hasText: /select sector/i }).click();
    await page.getByRole('option', { name: 'Technology' }).click();
    
    await page.getByRole('combobox').filter({ hasText: /select sub-sector/i }).click();
    await page.getByRole('option').first().click();
    
    await page.getByRole('button', { name: /add target company|create|save/i }).filter({ has: page.locator('text=/add|create|save/i') }).or(page.locator('button[type="submit"]')).click();
    
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    await expect(page.getByText(uniqueCompanyName)).toBeVisible({ timeout: 10000 });
  });

  test('should click a company and load detail page', async ({ page }) => {
    await page.goto('/target-companies');
    await page.waitForLoadState('networkidle');
    
    const companyCard = page.locator('[data-testid^="company-card"], a[href*="/target-companies/"]').first();
    
    if (await companyCard.count() === 0) {
      const companyLink = page.locator('text=/[A-Z][a-z]+.*Company|Inc|LLC|Ltd/').first();
      await companyLink.click();
    } else {
      await companyCard.click();
    }
    
    await page.waitForURL(/\/target-companies\/\d+/, { timeout: 10000 });
    
    await expect(page).toHaveURL(/\/target-companies\/\d+/);
    
    await expect(page.getByTestId('text-company-name').or(page.locator('h1'))).toBeVisible();
  });

  test('should switch between Overview and Documents tabs', async ({ page }) => {
    await page.goto('/target-companies');
    await page.waitForLoadState('networkidle');
    
    const companyCard = page.locator('[data-testid^="company-card"], a[href*="/target-companies/"]').first();
    if (await companyCard.count() > 0) {
      await companyCard.click();
    } else {
      await page.locator('text=/[A-Z][a-z]+/').first().click();
    }
    
    await page.waitForURL(/\/target-companies\/\d+/, { timeout: 10000 });
    
    const overviewTab = page.getByRole('tab', { name: /overview/i });
    const documentsTab = page.getByRole('tab', { name: /documents/i });
    
    await expect(overviewTab).toBeVisible();
    await expect(documentsTab).toBeVisible();
    
    await documentsTab.click();
    await expect(documentsTab).toHaveAttribute('data-state', 'active');
    
    await overviewTab.click();
    await expect(overviewTab).toHaveAttribute('data-state', 'active');
  });
});
