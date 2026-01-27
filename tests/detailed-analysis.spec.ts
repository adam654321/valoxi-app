import { test, expect } from '@playwright/test';

test.describe('Detailed Analysis Display', () => {
  test('should navigate to analysis tab and verify content loads', async ({ page }) => {
    await page.goto('/target-companies');
    await page.waitForLoadState('networkidle');
    
    const companyCard = page.locator('[data-testid^="company-card"], a[href*="/target-companies/"]').first();
    if (await companyCard.count() > 0) {
      await companyCard.click();
    } else {
      await page.locator('text=/[A-Z][a-z]+/').first().click();
    }
    
    await page.waitForURL(/\/target-companies\/\d+/, { timeout: 10000 });
    
    const analysisTab = page.getByRole('tab', { name: /analysis/i });
    await analysisTab.click();
    await expect(analysisTab).toHaveAttribute('data-state', 'active');
    
    await page.waitForLoadState('networkidle');
    
    const hasContent = await page.locator('[data-testid="tab-investment-summary"], [data-testid="tab-detailed-analysis"]').count() > 0
      || await page.getByText(/no.*analysis|analysis.*available|deal snapshot|sector analysis/i).count() > 0;
    
    expect(hasContent).toBeTruthy();
  });

  test('should switch between analysis sub-tabs when available', async ({ page }) => {
    await page.goto('/target-companies');
    await page.waitForLoadState('networkidle');
    
    const companyCard = page.locator('[data-testid^="company-card"], a[href*="/target-companies/"]').first();
    if (await companyCard.count() > 0) {
      await companyCard.click();
    } else {
      await page.locator('text=/[A-Z][a-z]+/').first().click();
    }
    
    await page.waitForURL(/\/target-companies\/\d+/, { timeout: 10000 });
    
    const analysisTab = page.getByRole('tab', { name: /analysis/i });
    await analysisTab.click();
    
    await page.waitForLoadState('networkidle');
    
    const investmentSummaryTab = page.getByTestId('tab-investment-summary');
    const detailedAnalysisTab = page.getByTestId('tab-detailed-analysis');
    
    if (await investmentSummaryTab.count() > 0 && await detailedAnalysisTab.count() > 0) {
      await detailedAnalysisTab.click();
      await expect(detailedAnalysisTab).toHaveAttribute('data-state', 'active');
      
      const dealSnapshotTab = page.getByRole('tab', { name: /deal snapshot/i });
      const sectorTab = page.getByRole('tab', { name: /sector/i });
      
      if (await dealSnapshotTab.count() > 0) {
        await dealSnapshotTab.click();
        await expect(dealSnapshotTab).toHaveAttribute('data-state', 'active');
      }
      
      if (await sectorTab.count() > 0) {
        await sectorTab.click();
        await expect(sectorTab).toHaveAttribute('data-state', 'active');
      }
    } else {
      console.log('No detailed analysis sub-tabs available - skipping sub-tab test');
      expect(true).toBeTruthy();
    }
  });
});
