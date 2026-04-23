import { expect, test, type Page } from '@playwright/test';

async function expectNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => {
    const scrollingElement = document.scrollingElement || document.documentElement;
    const bodyWidth = document.body ? document.body.scrollWidth : 0;

    return {
      viewportWidth: window.innerWidth,
      documentWidth: Math.max(
        scrollingElement.scrollWidth,
        document.documentElement.scrollWidth,
        bodyWidth,
      ),
    };
  });

  expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
}

test.describe('mobile smoke audit', () => {
  test('landing page stays compact on mobile', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /Finanzen im Griff/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Kostenlos starten/i }).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('login page remains usable on mobile', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: 'Finanzplanner' })).toBeVisible();
    await expect(page.getByPlaceholder('name@example.com')).toBeVisible();
    await expect(page.getByRole('button', { name: /Anmelden|Demo ausprobieren/i }).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('register page remains usable on mobile', async ({ page }) => {
    await page.goto('/register');

    await expect(page.getByPlaceholder('name@example.com').first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('demo dashboard keeps mobile shell stable', async ({ page }) => {
    await page.goto('/demo/dashboard');

    await expect(page.getByRole('main').getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('Aktueller Kontostand')).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('demo expenses stays navigable without horizontal page overflow', async ({ page }) => {
    await page.goto('/demo/expenses');

    await expect(page.getByRole('main').getByRole('heading', { name: 'Ausgaben' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Ausgabe erfassen/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('demo accounts and settings remain compact on mobile', async ({ page }) => {
    await page.goto('/demo/accounts');

    await expect(page.getByRole('heading', { name: /Konten & Nettovermögen/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Konto hinzufügen/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto('/demo/settings');

    await expect(page.getByRole('heading', { name: /Einstellungen & Backup-Center/i })).toBeVisible();
    await expect(page.getByText('Schnellzugriff auf die wichtigsten Einstellungen')).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});