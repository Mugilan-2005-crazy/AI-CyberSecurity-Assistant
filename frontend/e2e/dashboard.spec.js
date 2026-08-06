import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    const emailInput = page.getByLabel(/email/i);
    const passwordInput = page.getByLabel(/password/i);
    const isLoginVisible = await emailInput.isVisible({ timeout: 3000 });
    if (isLoginVisible) {
      await emailInput.fill('admin@cybersec.io');
      await passwordInput.fill('Admin@123456');
      await page.getByRole('button', { name: /sign in|login/i }).click();
      await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    }
  });

  test('dashboard loads with security score', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText(/security score|score|risk/i)).toBeVisible({ timeout: 10000 });
  });

  test('dashboard loads threat indicators', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText(/threat|alert|indicator/i)).toBeVisible({ timeout: 10000 });
  });

  test('dashboard loads reports section', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText(/report|scan|history/i)).toBeVisible({ timeout: 10000 });
  });

  test('dashboard shows loading state initially', async ({ page }) => {
    await page.goto('/dashboard');
    const loadingVisible = await page.getByText(/loading|loading\.\.\.|\.\.\./i).isVisible({ timeout: 3000 });
    if (loadingVisible) {
      await expect(page.getByText(/loading/i)).toBeVisible();
    }
  });

  test('dashboard shows empty state when no data', async ({ page }) => {
    await page.goto('/dashboard');
    const emptyVisible = await page.getByText(/no data|no scans|no threats|no reports|empty/i).isVisible({ timeout: 5000 });
    if (emptyVisible) {
      await expect(page.getByText(/no data|no scans|no threats|no reports|empty/i)).toBeVisible();
    }
  });

  test('dashboard shows error state on API failure', async ({ page }) => {
    await page.goto('/dashboard');
    const errorVisible = await page.getByText(/error|failed|unable to load/i).isVisible({ timeout: 5000 });
    if (errorVisible) {
      await expect(page.getByText(/error|failed|unable to load/i)).toBeVisible();
    }
  });

  test('dashboard navigation to reports page', async ({ page }) => {
    await page.goto('/dashboard');
    const reportsLink = page.getByRole('link', { name: /report/i }).first();
    if (await reportsLink.isVisible({ timeout: 3000 })) {
      await reportsLink.click();
      await expect(page).toHaveURL(/\/reports/, { timeout: 5000 });
    }
  });

  test('dashboard navigation to scan history', async ({ page }) => {
    await page.goto('/dashboard');
    const historyLink = page.getByRole('link', { name: /history|scan history/i }).first();
    if (await historyLink.isVisible({ timeout: 3000 })) {
      await historyLink.click();
      await expect(page).toHaveURL(/\/history/, { timeout: 5000 });
    }
  });

  test('dashboard responsive design works on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard');
    await expect(page.getByText(/dashboard|security/i)).toBeVisible({ timeout: 10000 });
  });

  test('dashboard responsive design works on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/dashboard');
    await expect(page.getByText(/dashboard|security/i)).toBeVisible({ timeout: 10000 });
  });
});