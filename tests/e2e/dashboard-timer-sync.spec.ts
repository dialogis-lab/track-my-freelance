import { test, expect } from '@playwright/test';

test.describe('Dashboard Timer Sync', () => {
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

  test('dashboard shows running stopwatch timer from project view', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const dashboardPage = await context1.newPage();
    const projectPage = await context2.newPage();
    
    await dashboardPage.goto('/dashboard');
    await projectPage.goto('/projects');
    
    // Start timer in project view
    await projectPage.selectOption('[data-testid="project-select"]', { index: 0 });
    await projectPage.click('[data-testid="start-timer"]');
    
    // Dashboard should show running timer within 1s
    await expect(dashboardPage.locator('[data-testid="timer-display"]')).not.toContainText('00:00:00', { timeout: 1000 });
    
    // Wait a moment and verify it's ticking
    await dashboardPage.waitForTimeout(2000);
    const timeText = await dashboardPage.locator('[data-testid="timer-display"]').textContent();
    
    // Should show elapsed time (at least 2 seconds)
    expect(timeText).toMatch(/00:00:0[2-9]|00:00:[1-9]\d/);
    
    await context1.close();
    await context2.close();
  });

  test('dashboard reflects pomodoro timer state', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const dashboardPage = await context1.newPage();
    const focusPage = await context2.newPage();
    
    await dashboardPage.goto('/dashboard');
    await focusPage.goto('/focus');
    
    // Start pomodoro session
    await focusPage.selectOption('[data-testid="project-select"]', { index: 0 });
    await focusPage.click('[data-testid="start-focus"]');
    
    // Dashboard should show active pomodoro within 1s
    await expect(dashboardPage.locator('[data-testid="pomodoro-badge"]')).toContainText('Focus', { timeout: 1000 });
    await expect(dashboardPage.locator('[data-testid="pomodoro-timer"]')).not.toContainText('25:00', { timeout: 1000 });
    
    // Pause from focus page
    await focusPage.click('[data-testid="pause-focus"]');
    
    // Dashboard should reflect paused state
    await expect(dashboardPage.locator('[data-testid="pomodoro-status"]')).toContainText('Paused', { timeout: 1000 });
    
    await context1.close();
    await context2.close();
  });

  test('timer state syncs between dashboard and project views', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const dashboardPage = await context1.newPage();
    const projectPage = await context2.newPage();
    
    await dashboardPage.goto('/dashboard');
    await projectPage.goto('/projects');
    
    // Start timer from dashboard
    await dashboardPage.selectOption('[data-testid="project-select"]', { index: 0 });
    await dashboardPage.click('[data-testid="start-timer"]');
    
    // Project view should show running timer
    await expect(projectPage.locator('[data-testid="stop-timer"]')).toBeVisible({ timeout: 1000 });
    
    // Stop timer from project view
    await projectPage.click('[data-testid="stop-timer"]');
    
    // Dashboard should show stopped state
    await expect(dashboardPage.locator('[data-testid="start-timer"]')).toBeVisible({ timeout: 1000 });
    await expect(dashboardPage.locator('[data-testid="timer-display"]')).toContainText('00:00:00');
    
    await context1.close();
    await context2.close();
  });

  test('dashboard timer survives page refresh', async ({ page }) => {
    // Start timer
    await page.selectOption('[data-testid="project-select"]', { index: 0 });
    await page.click('[data-testid="start-timer"]');
    
    // Wait for timer to be running
    await expect(page.locator('[data-testid="stop-timer"]')).toBeVisible();
    await page.waitForTimeout(2000);
    
    // Refresh dashboard
    await page.reload();
    
    // Timer should still be running and showing elapsed time
    await expect(page.locator('[data-testid="stop-timer"]')).toBeVisible({ timeout: 2000 });
    await expect(page.locator('[data-testid="timer-display"]')).not.toContainText('00:00:00');
  });

  test('dashboard shows accurate elapsed time within 200ms tolerance', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    await page1.goto('/dashboard');
    await page2.goto('/dashboard');
    
    // Start timer on page 1
    await page1.selectOption('[data-testid="project-select"]', { index: 0 });
    await page1.click('[data-testid="start-timer"]');
    
    // Wait exactly 3 seconds
    await page1.waitForTimeout(3000);
    
    // Get times from both pages
    const time1 = await page1.locator('[data-testid="timer-display"]').textContent();
    const time2 = await page2.locator('[data-testid="timer-display"]').textContent();
    
    // Parse times to seconds
    const parseTime = (timeStr: string) => {
      const [h, m, s] = timeStr.split(':').map(Number);
      return h * 3600 + m * 60 + s;
    };
    
    const seconds1 = parseTime(time1 || '00:00:00');
    const seconds2 = parseTime(time2 || '00:00:00');
    
    // Both should be around 3 seconds, within 200ms tolerance
    expect(seconds1).toBeGreaterThanOrEqual(2.8);
    expect(seconds1).toBeLessThanOrEqual(3.2);
    expect(Math.abs(seconds1 - seconds2)).toBeLessThanOrEqual(0.2);
    
    await context1.close();
    await context2.close();
  });
});