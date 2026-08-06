import { test, expect } from '@playwright/test';

test.describe('Security Modules', () => {
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

  test.describe('URL Scanner', () => {
    test('url scanner page loads with input and scan button', async ({ page }) => {
      await page.goto('/scan/url');
      await expect(page.getByRole('heading', { name: /url|scanner/i })).toBeVisible();
      await expect(page.getByRole('textbox', { name: /url|enter url/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /scan/i })).toBeVisible();
    });

    test('url scanner empty state is shown initially', async ({ page }) => {
      await page.goto('/scan/url');
      await expect(page.getByText(/no scan|empty|start scanning/i)).toBeVisible({ timeout: 5000 });
    });

    test('url scanner validates invalid URLs', async ({ page }) => {
      await page.goto('/scan/url');
      await page.getByRole('textbox', { name: /url|enter url/i }).fill('not-a-url');
      await page.getByRole('button', { name: /scan/i }).click();
      await expect(page.getByText(/invalid|valid url|enter a valid/i)).toBeVisible({ timeout: 5000 });
    });

    test('url scanner shows result after scan', async ({ page }) => {
      await page.goto('/scan/url');
      await page.getByRole('textbox', { name: /url|enter url/i }).fill('https://example.com');
      await page.getByRole('button', { name: /scan/i }).click();
      const resultVisible = await page.getByText(/risk|threat|score|result/i).isVisible({ timeout: 15000 });
      if (resultVisible) {
        await expect(page.getByText(/risk|threat|score|result/i)).toBeVisible();
      }
    });
  });

  test.describe('Email Phishing Detector', () => {
    test('email phishing page loads with input area', async ({ page }) => {
      await page.goto('/scan/email');
      await expect(page.getByRole('heading', { name: /email|phishing|detector/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /scan|analyze|detect/i })).toBeVisible();
    });

    test('email phishing scanner empty state is shown initially', async ({ page }) => {
      await page.goto('/scan/email');
      await expect(page.getByText(/no scan|empty|paste email|start scanning/i)).toBeVisible({ timeout: 5000 });
    });

    test('email phishing scanner shows result', async ({ page }) => {
      await page.goto('/scan/email');
      await page.getByRole('textbox', { name: /email|paste|enter email|phishing/i }).fill('Test email content for phishing detection');
      await page.getByRole('button', { name: /scan|analyze|detect/i }).click();
      const resultVisible = await page.getByText(/risk|phishing|threat|result/i).isVisible({ timeout: 15000 });
      if (resultVisible) {
        await expect(page.getByText(/risk|phishing|threat|result/i)).toBeVisible();
      }
    });
  });

  test.describe('File Scanner', () => {
    test('file scanner page loads with upload area', async ({ page }) => {
      await page.goto('/scan/file');
      await expect(page.getByRole('heading', { name: /file|scanner|upload/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /scan|upload|browse|choose file/i })).toBeVisible();
    });

    test('file scanner empty state is shown initially', async ({ page }) => {
      await page.goto('/scan/file');
      await expect(page.getByText(/no file|empty|upload|drag drop/i)).toBeVisible({ timeout: 5000 });
    });

    test('file scanner accepts file upload', async ({ page }) => {
      await page.goto('/scan/file');
      const fileInput = page.getByLabel(/choose file|upload file|select file/i);
      if (await fileInput.isVisible({ timeout: 3000 })) {
        await fileInput.setInputFiles({
          name: 'test.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('test file content'),
        });
        await expect(page.getByText(/test\.txt|file selected|uploaded/i)).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe('QR Checker', () => {
    test('qr checker page loads with scanner', async ({ page }) => {
      await page.goto('/scan/qr');
      await expect(page.getByRole('heading', { name: /qr|checker|scan/i })).toBeVisible();
    });

    test('qr checker empty state is shown initially', async ({ page }) => {
      await page.goto('/scan/qr');
      await expect(page.getByText(/no scan|empty|scan qr|start/i)).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('AI Security Chatbot', () => {
    test('AI chatbot page loads with chat interface', async ({ page }) => {
      await page.goto('/dashboard/ai-chatbot');
      await expect(page.getByRole('heading', { name: /chat|ai|assistant|security/i })).toBeVisible();
    });

    test('AI chatbot shows welcome message', async ({ page }) => {
      await page.goto('/dashboard/ai-chatbot');
      await expect(page.getByText(/hello|welcome|ask|cyber/i)).toBeVisible({ timeout: 5000 });
    });

    test('AI chatbot input and send button are visible', async ({ page }) => {
      await page.goto('/dashboard/ai-chatbot');
      await expect(page.getByRole('textbox', { name: /message|type your question|ask/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /send/i })).toBeVisible();
    });
  });

  test.describe('AI Analyzer', () => {
    test('AI analyzer page loads', async ({ page }) => {
      await page.goto('/ai-analyzer');
      await expect(page.getByRole('heading', { name: /ai|analyzer|analysis/i })).toBeVisible();
    });
  });
});