import { test, expect } from '@playwright/test';

test.describe('Sequences', () => {
  test('should display sequences empty state', async ({ page }) => {
    await page.goto('/sequences');
    
    // We expect an empty state according to the audit
    await expect(page.locator('text=Select a sequence to view details')).toBeVisible();
  });
});
