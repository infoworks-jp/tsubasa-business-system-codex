import { expect, test } from '@playwright/test';

const views = ['kpi','products','abc','weekday','hourly','monthly','consulting','qa','bank'];
const accessToken = process.env.SUPABASE_ADMIN_JWT;

test.beforeEach(async ({ page }) => {
  if (!accessToken) throw new Error('SUPABASE_ADMIN_JWT is required for authenticated QA');
  await page.goto('/');
  await page.evaluate(token => sessionStorage.setItem('tsubasa_qa_api_key', token), accessToken);
  await page.reload({ waitUntil: 'networkidle' });
});

for (const view of views) {
  test(`${view}: numbers, console, links and screenshot`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`/#/${view}`, { waitUntil: 'networkidle' });
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('body')).not.toContainText('読込中…');
    for (const link of await page.locator('nav a').all()) {
      const href = await link.getAttribute('href');
      expect(href).toMatch(/^#\/(kpi|products|abc|weekday|hourly|monthly|consulting|qa|bank)$/);
    }
    expect(errors).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`${view}.png`), fullPage: true });
  });
}

test('QA release gate is zero', async ({ page }) => {
  await page.goto('/#/qa', { waitUntil: 'networkidle' });
  await expect(page.getByText('NG合計').locator('..').locator('strong')).toHaveText('0件');
});

test('404 fallback returns the app', async ({ page }) => {
  const response = await page.goto('/404.html');
  expect(response?.status()).toBeLessThan(400);
});
