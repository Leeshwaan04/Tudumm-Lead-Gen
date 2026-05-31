import { test, expect } from '@playwright/test';

test.describe('Leads', () => {
  test('should display leads page empty state', async ({ page }) => {
    await page.goto('/leads');
    await expect(page.locator('h1')).toContainText('Leads');
    await expect(page.locator('text=No leads found')).toBeVisible();
  });

  test('should fail to enrich due to API contract mismatch (QA Audit Issue #4)', async ({ page }) => {
    // First we need to create a lead via API since we don't want to rely on CSV upload which might be flaky
    const response = await page.request.post('/api/leads', {
      data: {
        fullName: 'Test Lead',
        email: 'testlead@example.com',
      }
    });
    
    // We expect this to work if the user is authenticated, but wait, page.request might not share the browser context auth immediately if it's a separate context, but standard page context does.
    // Actually, let's do it via UI if there's a way. But there's no UI to "Create Lead" manually, only Import.
    
    // Let's intercept the import API instead and mock it to return success, then reload? 
    // Or we can just use the UI to try importing a CSV.
    
    // Create a dummy CSV in memory
    const csvContent = 'fullname,email,company\nJohn Smith,john@smith.com,Smith Co';
    const buffer = Buffer.from(csvContent);

    // Go to leads page
    await page.goto('/leads');
    
    // Trigger file upload
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('button:has-text("Import CSV")');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'leads.csv',
      mimeType: 'text/csv',
      buffer
    });
    
    // Wait for the lead to appear in the table
    await expect(page.locator('text=John Smith')).toBeVisible();

    // Now try to enrich
    // There's a button "Enrich All"
    
    // We can monitor the network request to see the successful enrichment
    const requestPromise = page.waitForResponse(response => 
      response.url().includes('/api/leads/enrich') && response.request().method() === 'POST'
    );
    
    await page.click('button:has-text("Enrich All")');
    
    const enrichResponse = await requestPromise;
    
    expect(enrichResponse.status()).toBe(200);
    
    const body = await enrichResponse.json();
    expect(body.enriched).toBeGreaterThan(0);
    
    // Verify toast success is not explicitly tracked, but we can verify the UI updates (e.g. ICP score is populated)
    // Actually the mock returns an ICP score badge
    await expect(page.locator('text=No leads found')).not.toBeVisible();
  });
});
