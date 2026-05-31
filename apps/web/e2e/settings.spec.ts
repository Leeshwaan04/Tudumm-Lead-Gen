import { test, expect } from '@playwright/test';

test.describe('Settings', () => {
  test('should fail to display API key secret properly (QA Audit Issue #3)', async ({ page }) => {
    await page.goto('/settings');
    
    // Switch to API Keys tab
    await page.click('button[role="tab"]:has-text("API Keys")');
    
    // Open create modal
    await page.click('button:has-text("Create API Key")');
    
    // Fill the name
    const keyName = 'Test Key ' + Math.random().toString(36).slice(2, 7);
    await page.fill('input[name="name"]', keyName);
    
    // Submit
    // We want to monitor the API response to see what the actual raw key is
    const requestPromise = page.waitForResponse(response => 
      response.url().includes('/api/settings/apikeys') && response.request().method() === 'POST'
    );
    
    await page.click('button[type="submit"]:has-text("Create Key")');
    
    const createResponse = await requestPromise;
    expect(createResponse.status()).toBe(201);
    
    const body = await createResponse.json();
    const actualRawKey = body.raw; // e.g., tdk_abcdef...
    const uuidId = body.id; // e.g., 123e4567-e89b-12d3...
    
    // Now verify what the UI displays in the success modal
    // The UI is supposed to show the secret key (data.raw) but according to audit it shows (data.key ?? data.id) which defaults to data.id.
    
    await expect(page.locator('text=Key created successfully')).toBeVisible();
    
    // The displayed key is in a code block or input
    const displayedKey = await page.inputValue('input[readOnly]');
    
    // This is the bug: The UI shows the UUID instead of the raw secret
    expect(displayedKey).not.toBe(actualRawKey);
    expect(displayedKey).toBe(uuidId);
  });
});
