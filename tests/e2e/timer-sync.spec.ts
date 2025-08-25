import { test, expect } from '@playwright/test';

test.describe('Timer Cross-Device Sync', () => {
  test.beforeEach(async ({ page }) => {
    // Enable debug logging for tests
    await page.addInitScript(() => {
      localStorage.setItem('TIMER_DEBUG', '1');
    });
    
    // Mock login - adjust this based on your auth flow
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'testpassword');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/dashboard');
  });

  test('stopwatch sync between two tabs', async ({ browser }) => {
    // Create two browser contexts to simulate different devices
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    // Set up both pages
    await page1.goto('/dashboard');
    await page2.goto('/dashboard');
    
    // Select project on page 1 and start timer
    await page1.selectOption('[data-testid="project-select"]', { index: 0 });
    await page1.click('[data-testid="start-timer"]');
    
    // Wait for timer to start
    await expect(page1.locator('[data-testid="timer-display"]')).toContainText('00:00:0');
    
    // Check that page 2 reflects the running timer within 1 second
    await expect(page2.locator('[data-testid="timer-display"]')).toContainText('00:00:0', { timeout: 1000 });
    await expect(page2.locator('[data-testid="stop-timer"]')).toBeVisible({ timeout: 1000 });
    
    // Wait a moment for elapsed time
    await page1.waitForTimeout(2000);
    
    // Stop timer on page 2
    await page2.click('[data-testid="stop-timer"]');
    
    // Verify page 1 reflects the stopped state
    await expect(page1.locator('[data-testid="start-timer"]')).toBeVisible({ timeout: 1000 });
    await expect(page1.locator('[data-testid="timer-display"]')).toContainText('00:00:00');
    
    await context1.close();
    await context2.close();
  });

  test('pomodoro sync between two tabs', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    await page1.goto('/dashboard');
    await page2.goto('/dashboard');
    
    // Switch to Pomodoro mode on page 1
    await page1.click('[data-testid="pomodoro-tab"]');
    await page2.click('[data-testid="pomodoro-tab"]');
    
    // Select project and start focus session on page 1
    await page1.selectOption('[data-testid="project-select"]', { index: 0 });
    await page1.click('[data-testid="start-focus"]');
    
    // Verify page 2 shows running pomodoro
    await expect(page2.locator('[data-testid="focus-badge"]')).toContainText('Focus', { timeout: 1000 });
    await expect(page2.locator('[data-testid="pomodoro-active-badge"]')).toContainText('Active', { timeout: 1000 });
    
    // Pause on page 2
    await page2.click('[data-testid="pause-focus"]');
    
    // Verify page 1 reflects paused state
    await expect(page1.locator('[data-testid="resume-pomodoro"]')).toBeVisible({ timeout: 1000 });
    
    await context1.close();
    await context2.close();
  });

  test('timer state persists across page refresh', async ({ page }) => {
    // Start timer
    await page.selectOption('[data-testid="project-select"]', { index: 0 });
    await page.click('[data-testid="start-timer"]');
    
    // Wait for timer to be running
    await expect(page.locator('[data-testid="stop-timer"]')).toBeVisible();
    
    // Refresh page
    await page.reload();
    
    // Verify timer is still running after reload
    await expect(page.locator('[data-testid="stop-timer"]')).toBeVisible({ timeout: 2000 });
    await expect(page.locator('[data-testid="timer-display"]')).not.toContainText('00:00:00');
  });
});