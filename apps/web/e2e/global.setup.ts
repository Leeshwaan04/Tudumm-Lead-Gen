import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../.auth/user.json');

setup('authenticate', async ({ page }) => {
  // Generate a unique email for the test run
  const uniqueId = Math.random().toString(36).slice(2, 7);
  const testEmail = `testuser_${uniqueId}@example.com`;
  
  await page.goto('/register');
  
  // Wait for the form to be ready
  await page.waitForSelector('input[name="name"]');
  
  // Fill the registration form
  await page.fill('input[name="name"]', 'QA Tester');
  await page.fill('input[name="email"]', testEmail);
  await page.fill('input[name="password"]', 'TestPass123!');
  
  // Submit the form
  await page.click('button[type="submit"]');
  
  // Wait for redirect to dashboard
  await page.waitForURL('**/dashboard');
  
  // Ensure the UI has loaded and the workspace is initialized
  await expect(page.locator('h1')).toContainText('Dashboard');
  
  // Save authentication state
  await page.context().storageState({ path: authFile });
});
