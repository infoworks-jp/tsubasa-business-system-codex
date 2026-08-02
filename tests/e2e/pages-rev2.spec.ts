import { expect, test } from '@playwright/test';

const tabs = [
  ['overview', '概要'], ['monthly', '月別'], ['management', '月別経営分析'],
  ['payroll', '人件費'], ['consulting', '経営コンサル'], ['daily', '日別'],
  ['weekday', '曜日別'], ['products', '商品別・全商品'], ['abc', 'ABC分析'],
  ['beer', 'ビール・セット'], ['hourly', '時間帯'], ['bank', '売上入金照合'],
  ['expenses', '仕入・外注・経費'], ['quality', '品質検証']
] as const;

test.beforeEach(async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('#updated')).toContainText('データ更新');
});

test('14タグの名称・順番とDB基準数字', async ({ page }) => {
  await expect(page.locator('.tabs button')).toHaveText(tabs.map(([, label]) => label));
  await expect(page.locator('#monthSelect option')).toHaveCount(2);
  await page.selectOption('#monthSelect', '2026-06');
  await expect(page.locator('#cards')).toContainText('¥4,995,250');
  await page.selectOption('#monthSelect', '2026-07');
  await expect(page.locator('#cards')).toContainText('¥4,917,050');
  await page.locator('#scopeAll').click();
  await expect(page.locator('#cards')).toContainText('¥9,912,300');
});

for (const [tab, label] of tabs) {
  for (const scope of ['2026-06', '2026-07', 'all'] as const) {
    test(`${label}・${scope}・表示と操作`, async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      page.on('pageerror', error => errors.push(error.message));
      if (scope === 'all') await page.locator('#scopeAll').click();
      else await page.selectOption('#monthSelect', scope);
      await page.locator(`#t_${tab}`).click();
      await expect(page.locator(`#t_${tab}`)).toHaveClass(/active/);
      await expect(page.locator('#host')).not.toContainText('読み込み中');
      await expect(page.locator('#host')).not.toBeEmpty();
      expect(errors).toEqual([]);
      await page.screenshot({ path: testInfo.outputPath(`${tab}-${scope}.png`), fullPage: true });
    });
  }
}

test('6月商品復元と未確定データを0円扱いしない', async ({ page }) => {
  await page.selectOption('#monthSelect', '2026-06');
  await page.locator('#t_products').click();
  await expect(page.locator('#integrity')).toContainText('¥4,995,250 一致');
  await expect(page.locator('#host')).toContainText('全商品 40品目');
  await page.selectOption('#monthSelect', '2026-07');
  await page.locator('#t_hourly').click({ force: true });
  await expect(page.locator('#integrity')).toContainText('5営業日分');
  await page.locator('#t_payroll').click({ force: true });
  await expect(page.locator('#host')).toContainText('未確定');
});

test('公開後に判明した6月欠落を再発させない', async ({ page }) => {
  await page.selectOption('#monthSelect', '2026-06');

  await page.locator('#t_hourly').click();
  await expect(page.locator('#host')).toContainText('2026年6月 時間帯別 売上');
  await expect(page.locator('#integrity')).toContainText('28営業日分');
  await expect(page.locator('#host')).toContainText('¥5,025,340');

  await page.locator('#t_payroll').click();
  await expect(page.locator('#host')).toContainText('社会保険料');
  await expect(page.locator('#host')).toContainText('¥314,440');
  await expect(page.locator('#host')).toContainText('¥2,028,986');

  await page.locator('#t_expenses').click({ force: true });
  await expect(page.locator('#host')).toContainText('仕入・外注支払');
  await expect(page.locator('#host')).not.toContainText('0件');

  await page.locator('#t_bank').click({ force: true });
  await expect(page.locator('#host')).toContainText('2026-06-01');
  await expect(page.locator('#host')).toContainText('2026-06-28');
  const june2Deposit = page.locator('#host tr').filter({ hasText: '2026-06-02' }).filter({ hasText: '¥134,620' });
  await expect(june2Deposit).toContainText('一致');

  await page.selectOption('#monthSelect', '2026-07');
  await page.locator('#t_daily').click({ force: true });
  const july27 = page.locator('#host tr').filter({ hasText: '2026-07-27' });
  await expect(july27).toContainText('休業');
  await expect(july27).not.toContainText('入力待ち');

  await page.locator('#t_consulting').click({ force: true });
  await expect(page.locator('#host')).toContainText('現状判断');
  await expect(page.locator('#host')).toContainText('実行優先順位');
});

test('404 fallback', async ({ page }) => {
  const response = await page.goto('/404.html');
  expect(response?.status()).toBeLessThan(400);
});
