import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Document Management', () => {
  const testFileName = `test-doc-${Date.now()}.txt`;
  const testFilePath = path.join(__dirname, testFileName);

  test.beforeAll(async () => {
    fs.writeFileSync(testFilePath, 'This is a test document for E2E testing.');
  });

  test.afterAll(async () => {
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  });

  test('should upload a document and verify it appears in list', async ({ page }) => {
    await page.goto('/target-companies');
    await page.waitForLoadState('networkidle');
    
    const companyCard = page.locator('[data-testid^="company-card"], a[href*="/target-companies/"]').first();
    if (await companyCard.count() > 0) {
      await companyCard.click();
    } else {
      await page.locator('text=/[A-Z][a-z]+/').first().click();
    }
    
    await page.waitForURL(/\/target-companies\/\d+/, { timeout: 10000 });
    
    const documentsTab = page.getByRole('tab', { name: /documents/i });
    await documentsTab.click();
    await expect(documentsTab).toHaveAttribute('data-state', 'active');
    
    await page.waitForLoadState('networkidle');
    
    const uploadButton = page.getByRole('button', { name: /upload/i }).first();
    await uploadButton.click();
    
    await page.waitForSelector('input[type="file"]', { state: 'attached', timeout: 5000 });
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    
    const documentTypeSelect = page.locator('button[role="combobox"]').first();
    if (await documentTypeSelect.isVisible()) {
      await documentTypeSelect.click();
      await page.getByRole('option').first().click();
    }
    
    const submitButton = page.getByRole('button', { name: /upload|submit|save/i }).filter({ hasText: /upload|submit|save/i });
    await submitButton.click();
    
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('h4').filter({ hasText: testFileName })).toBeVisible({ timeout: 15000 });
  });

  test('should open document viewer when clicking View/Analyze', async ({ page }) => {
    await page.goto('/target-companies');
    await page.waitForLoadState('networkidle');
    
    const companyCard = page.locator('[data-testid^="company-card"], a[href*="/target-companies/"]').first();
    if (await companyCard.count() > 0) {
      await companyCard.click();
    } else {
      await page.locator('text=/[A-Z][a-z]+/').first().click();
    }
    
    await page.waitForURL(/\/target-companies\/\d+/, { timeout: 10000 });
    
    const documentsTab = page.getByRole('tab', { name: /documents/i });
    await documentsTab.click();
    
    await page.waitForLoadState('networkidle');
    
    const viewButton = page.getByRole('button', { name: /view|analyze|preview/i }).first();
    
    if (await viewButton.count() > 0) {
      await viewButton.click();
      
      await expect(page.getByRole('dialog').last()).toBeVisible({ timeout: 10000 });
    } else {
      console.log('No documents available to view - skipping view test');
      test.skip();
    }
  });
});
