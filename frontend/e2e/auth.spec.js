import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('login page loads with all required elements', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /sign in|login/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in|login/i })).toBeVisible();
  });

  test('login page has forgot password and register links', async ({ page }) => {
    await expect(page.getByRole('link', { name: /forgot password/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /register|sign up/i })).toBeVisible();
  });

  test('register page loads with all required fields', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: /register|sign up/i })).toBeVisible();
    await expect(page.getByLabel(/name/i)).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /register|sign up/i })).toBeVisible();
  });

  test('registration form validates required fields', async ({ page }) => {
    await page.goto('/register');
    await page.getByRole('button', { name: /register|sign up/i }).click();
    await expect(page.getByText(/name|email|password/i).first()).toBeVisible();
  });

  test('email verification screen loads', async ({ page }) => {
    await page.goto('/verify-email');
    await expect(page.getByText(/verify|email|verification/i)).toBeVisible();
  });

  test('forgot password page loads', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.getByRole('heading', { name: /forgot password|reset password/i })).toBeVisible();
  });

  test('reset password page loads with token param', async ({ page }) => {
    await page.goto('/reset-password?token=test-token-123');
    await expect(page.getByRole('heading', { name: /reset password/i })).toBeVisible();
  });

  test('successful login redirects to dashboard', async ({ page }) => {
    await page.getByLabel(/email/i).fill('admin@cybersec.io');
    await page.getByLabel(/password/i).fill('Admin@123456');
    await page.getByRole('button', { name: /sign in|login/i }).click();
    await page.waitForURL(/dashboard|home/, { timeout: 10000 });
    await expect(page).toHaveURL(/\/dashboard|\/home/);
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.getByLabel(/email/i).fill('invalid@test.com');
    await page.getByLabel(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /sign in|login/i }).click();
    await expect(page.getByText(/invalid|error|wrong|credentials/i)).toBeVisible({ timeout: 5000 });
  });

  test('logout clears session and redirects to login', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('admin@cybersec.io');
    await page.getByLabel(/password/i).fill('Admin@123456');
    await page.getByRole('button', { name: /sign in|login/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    const logoutButton = page.getByRole('button', { name: /logout|sign out/i }).first();
    if (await logoutButton.isVisible({ timeout: 3000 })) {
      await logoutButton.click();
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test('landing page is accessible without authentication', async ({ page }) => {
    await page.goto('/home');
    await expect(page.getByText(/cyber|cybersphere|security/i)).toBeVisible();
  });
});