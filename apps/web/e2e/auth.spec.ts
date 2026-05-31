import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  // We don't use global setup for this test since we are testing the auth flow itself
  test.use({ storageState: { cookies: [], origins: [] } });

  test('should register a new user and create a workspace', async ({ page }) => {
    const uniqueId = Math.random().toString(36).slice(2, 7);
    const testEmail = `newuser_${uniqueId}@example.com`;
    
    await page.goto('/register');
    
    // Fill the registration form
    await page.fill('input[name="name"]', 'John Doe');
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', 'TestPass123!');
    
    // Submit the form
    await page.click('button[type="submit"]');
    
    // Should be redirected to the dashboard
    await page.waitForURL('**/dashboard');
    
    // Expect the user's name to be visible somewhere, or just the dashboard title
    await expect(page.locator('h1')).toContainText('Dashboard');
  });

  test('should login existing user', async ({ page }) => {
    // First, register a user to ensure they exist
    const uniqueId = Math.random().toString(36).slice(2, 7);
    const testEmail = `login_${uniqueId}@example.com`;
    
    // We can use an API call to create the user, but testing the UI flow is better
    await page.goto('/register');
    await page.fill('input[name="name"]', 'Login User');
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', 'TestPass123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
    
    // Logout
    await page.click('button:has-text("U")'); // Open user menu
    await page.click('button:has-text("Sign out")');
    await page.waitForURL('**/login');
    
    // Login
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', 'TestPass123!');
    await page.click('button[type="submit"]');
    
    // Verify dashboard access
    await page.waitForURL('**/dashboard');
    await expect(page.locator('h1')).toContainText('Dashboard');
  });
});
