import { expect, test } from '@playwright/test';

const tabs = [
  ['overview', '概要'], ['monthly', '月別'], ['management', '月別経営分析'],
  ['payroll', 'FL・改善推移'], ['consulting', '経営コンサル'], ['daily', '日別'],
  ['weekday', '曜日別'], ['products', '商品別・全商品'], ['abc', 'ABC分析'],
  ['beer', 'ビール・セット'], ['hourly', '時間帯'], ['bank', '売上入金照合'],
  ['expenses', '仕入・外注・経費'], ['quality', '品質検証']
] as const;

test.beforeEach(async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#updated')).toContainText('データ更新');
});

test('主要画面の名称・順番とDB連動数字', async ({ page }) => {
  const expectedTabLabels = [
    ...tabs.slice(0, -1).map(([, label]) => label),
    '仕入数量・変動原価', '曜日×昼・夜・深夜',
    tabs.at(-1)![1],
  ];
  await expect(page.locator('.tabs button[id^="t_"]')).toHaveText(expectedTabLabels);
  const months = await page.locator('#monthSelect option').evaluateAll(options =>
    options.map(option => ({
      value: (option as HTMLOptionElement).value,
      label: option.textContent || '',
    })),
  );
  expect(months.map(month => month.value)).toEqual(expect.arrayContaining(['2026-06', '2026-07', '2026-08']));
  expect(months.map(month => month.label)).toEqual(expect.arrayContaining(['2026年6月', '2026年7月', '2026年8月']));

  // 検算済みの過去月は固定値でデータ消失・改変を検知する。
  await page.selectOption('#monthSelect', '2026-06');
  await expect(page.locator('#cards')).toContainText('¥4,995,250');
  await page.selectOption('#monthSelect', '2026-07');
  await expect(page.locator('#cards')).toContainText('¥4,917,050');

  // 追加中の月と累計は固定値にせず、現在のDB集計と画面を照合する。
  for (const month of months.map(item => item.value).filter(value => value !== '2026-06' && value !== '2026-07')) {
    const overview = await page.evaluate(async scope => {
      return (window as typeof window & {
        rev2Api: (url: string) => Promise<{ month_sales: number }>;
      }).rev2Api(`/api/overview/${scope}`);
    }, month);
    expect(overview.month_sales).toBeGreaterThanOrEqual(0);
    await page.selectOption('#monthSelect', month);
    await expect(page.locator('#cards')).toContainText(overview.month_sales===0?'券売機未登録':`¥${overview.month_sales.toLocaleString('ja-JP')}`);
  }

  const allOverview = await page.evaluate(async () => {
    return (window as typeof window & {
      rev2Api: (url: string) => Promise<{ total_sales: number; total_days: number }>;
    }).rev2Api('/api/overview/all');
  });
  await page.locator('#scopeAll').click();
  await expect(page.locator('#cards')).toContainText(`¥${allOverview.total_sales.toLocaleString('ja-JP')}`);
  await expect(page.locator('#cards')).toContainText(`${allOverview.total_days}日`);
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

test('商品・時間帯復元と給与未確定データを0円扱いしない', async ({ page }) => {
  await page.selectOption('#monthSelect', '2026-06');
  await page.locator('#t_products').click();
  await expect(page.locator('#integrity')).toContainText('¥4,995,250 一致');
  await expect(page.locator('#host')).toContainText('全商品 40品目');
  await page.selectOption('#monthSelect', '2026-07');
  await page.locator('#t_hourly').click({ force: true });
  await expect(page.locator('#integrity')).toContainText('27営業日分');
  await page.locator('#t_payroll').click({ force: true });
  await expect(page.locator('#fl-table tr[data-month="2026-07"]')).toContainText('会社負担分未確認');
  await page.selectOption('#monthSelect', '2026-08');
  await expect(page.locator('#host')).toContainText('未確定');
});

test('全期間の品質状態をDBと一致させる', async ({ page }) => {
  const quality = await page.evaluate(async () => {
    return (window as typeof window & {
      rev2Api: (url: string) => Promise<{
        daily: number;
        matched: boolean;
        source_scope: { product: string; hourly: string; document: string; retained_original: string };
      }>;
    }).rev2Api('/api/quality/all') as Promise<{
      daily: number;
      matched: boolean;
      source_scope: { product: string; hourly: string; document: string; retained_original: string };
    }>;
  });
  await page.locator('#scopeAll').click();
  await page.locator('#t_quality').click();
  await expect(page.locator('#host')).toContainText(`¥${quality.daily.toLocaleString('ja-JP')}`);
  await expect(page.locator('#host')).toContainText(quality.source_scope.product);
  await expect(page.locator('#host')).toContainText(quality.source_scope.hourly);
  await expect(page.locator('#host')).toContainText(quality.source_scope.document);
  await expect(page.locator('#host')).toContainText(quality.source_scope.retained_original);
  const overallCheck = page.locator('#host .card').filter({ hasText: '総合検算' });
  await expect(overallCheck).toContainText(quality.matched ? '一致' : '要確認');
  const june29 = page.locator('#host tr').filter({ hasText: '2026-06-29' }).filter({ hasText: '40行' });
  await expect(june29).toContainText('192');
  await expect(june29).toContainText('¥174,570');
  await expect(june29).toContainText('¥2,700');
  await expect(june29).toContainText('¥171,870');
});

test('全登録月を欠損のまま確定表示しない', async ({ page }) => {
  const months = await page.locator('#monthSelect option').evaluateAll(options =>
    options.map(option => (option as HTMLOptionElement).value),
  );
  for (const month of months) {
    const quality = await page.evaluate(async scope => {
      return (window as typeof window & {
        rev2Api: (url: string) => Promise<{ matched: boolean }>;
      }).rev2Api(`/api/quality/${scope}`);
    }, month);
    await page.selectOption('#monthSelect', month);
    const [year, monthNumber] = month.split('-');
    await expect(page.locator('#integrity')).toContainText(`${year}年${Number(monthNumber)}月`);
    await page.locator('#t_quality').click({ force: true });
    await expect(page.locator('#integrity .notice')).toHaveClass(quality.matched ? /ok/ : /ng/);
    await expect(page.locator('#integrity')).toContainText(quality.matched ? '売上検算 一致' : '売上検算 要確認');
    await expect(page.locator('#host .notice').first()).toContainText(quality.matched ? '検算一致' : '検算は未合格です');
    const overallCheck = page.locator('#host .card').filter({ hasText: '総合検算' });
    await expect(overallCheck).toContainText(quality.matched ? '一致' : '要確認');
  }
});

test('公開後に判明した6月欠落を再発させない', async ({ page }) => {
  await page.selectOption('#monthSelect', '2026-06');

  await page.locator('#t_hourly').click();
  await expect(page.locator('#host')).toContainText('2026年6月 時間帯別 発行額');
  await expect(page.locator('#integrity')).toContainText('28営業日分');
  await expect(page.locator('#host')).toContainText('¥5,025,340');

  await page.locator('#t_payroll').click();
  await expect(page.locator('#host')).toContainText('社会保険料');
  await expect(page.locator('#host')).toContainText('¥314,440');
  await expect(page.locator('#fl-table tr[data-month="2026-06"]')).toContainText('¥188,934');
  await expect(page.locator('#fl-insurance')).toContainText('2026-07-30');

  await page.locator('#t_expenses').click({ force: true });
  await expect(page.locator('#host')).toContainText('仕入・外注支払');
  await expect(page.locator('#host')).not.toContainText('0件');

  await page.locator('#t_bank').click({ force: true });
  await expect(page.locator('#host')).toContainText('2026-06-28');
  const june2Deposit = page.locator('#host tr').filter({ hasText: '2026-06-02' }).filter({ hasText: '¥134,620' });
  await expect(june2Deposit).toContainText('一致');
  const june3Deposit = page.locator('#host tr').filter({ hasText: '2026-06-03' }).filter({ hasText: '¥186,670' });
  await expect(june3Deposit).toContainText('一致');
  const june4Deposit = page.locator('#host tr').filter({ hasText: '2026-06-04' }).filter({ hasText: '¥99,950' });
  await expect(june4Deposit).toContainText('一致');
  await expect(page.locator('#host')).toContainText('売上日要確認');

  await page.selectOption('#monthSelect', '2026-07');
  await page.locator('#t_daily').click({ force: true });
  const july27 = page.locator('#host tr').filter({ hasText: '2026-07-27' });
  await expect(july27).toContainText('休業');
  await expect(july27).not.toContainText('入力待ち');

  await page.locator('#t_consulting').click({ force: true });
  await expect(page.locator('#host')).toContainText('現状判断');
  await expect(page.locator('#host')).toContainText('実行優先順位');
});

test('7月通帳を取得上限で欠落させない', async ({ page }) => {
  await page.selectOption('#monthSelect', '2026-07');
  await page.locator('#t_expenses').click({ force: true });
  await expect(page.locator('#host')).toContainText('2026-07-31');
  await expect(page.locator('#host')).toContainText('¥5,798,188');
  await expect(page.locator('#host')).toContainText('62件');
});

test('9月商品原票を全日検算し通常分析を表示する', async ({ page }) => {
  await page.selectOption('#monthSelect', '2026-09');
  const products = await page.evaluate(async () => (window as typeof window & {
    rev2Api: (url: string) => Promise<Array<{ name: string; qty: number; sales: number }>>;
  }).rev2Api('/api/products/2026-09'));
  const beer = products.filter(row => /ビール/.test(row.name));
  const beerSales = beer.reduce((sum, row) => sum + row.sales, 0);
  const beerQuantity = beer.reduce((sum, row) => sum + row.qty, 0);
  const quality = await page.evaluate(async () => (window as typeof window & {
    rev2Api: (url: string) => Promise<{
      matched: boolean;
      coverage: { hourly_status: string; operating_days: number; hourly_days: number };
    }>;
  }).rev2Api('/api/quality/2026-09'));
  await page.locator('#t_beer').click({ force: true });
  await expect(page.locator('#host')).toContainText('商品別原票は全営業日分そろっています');
  await expect(page.locator('#host')).toContainText('ビール売上');
  await expect(page.locator('#host')).toContainText(`¥${beerSales.toLocaleString('ja-JP')}`);
  await expect(page.locator('#host')).toContainText(`${beerQuantity}本`);
  await expect(page.locator('#host')).toContainText('生ビール');
  await expect(page.locator('#host')).toContainText('瓶ビール');
  await expect(page.locator('#host')).not.toContainText('ビール売上 ¥0');

  await page.locator('#t_abc').click();
  await expect(page.locator('#host')).toContainText('累積構成比');
  await expect(page.locator('#host')).not.toContainText('分析不可');

  await page.locator('#t_executive').click({ force: true });
  await expect(page.locator('#host')).toContainText('9月の商品分析を使い');
  await expect(page.locator('#host')).not.toContainText('9月の商品別データを確認して');

  await page.selectOption('#monthSelect', '2026-08');
  await page.locator('#t_products').click();
  await expect(page.locator('#host')).toContainText('26営業日中23日分の原票を登録済み');
  await expect(page.locator('#host svg')).toHaveCount(0);

  await page.selectOption('#monthSelect', '2026-09');
  await page.locator('#t_hourly').click({ force: true });
  await expect(page.locator('#host')).toContainText('発行ベース');
  if (quality.coverage.hourly_status === 'complete') {
    await expect(page.locator('#host')).toContainText('全営業日分登録済み');
    await expect(page.locator('#host svg')).not.toHaveCount(0);
  } else {
    await expect(page.locator('#host')).toContainText(
      `${quality.coverage.operating_days}営業日中${quality.coverage.hourly_days}日分のみ・要確認`,
    );
    await expect(page.locator('#host svg')).toHaveCount(0);
  }

  await page.locator('#t_quality').click({ force: true });
  await expect(page.locator('#host')).toContainText(quality.matched ? '検算一致' : '検算は未合格です');
  const september4 = page.locator('#host tr').filter({ hasText: '2026-09-04' }).filter({ hasText: '¥259,410' });
  await expect(september4).toContainText('¥1,600');
  await expect(september4).toContainText('参考差異');
});

test('長期原票客数と2系列を混同しない', async ({ page }) => {
  const historical = await page.evaluate(async () => (window as typeof window & {
    rev2Api: (url: string) => Promise<Array<{ month: string; customers: number }>>;
  }).rev2Api('/api/historical-monthly'));
  expect(historical.find(row => row.month === '2026-08')?.customers).toBe(4002);
  await page.locator('#t_executive').click({ force: true });
  await expect(page.locator('#host')).toContainText('長期原票系列と券売機確定系列は別物です');
  await expect(page.locator('#host')).toContainText('4,002人');
  await expect(page.locator('#host')).toContainText('3,640人');
});

test('スマホ相当でも主要導線と欠損表示が読める', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.selectOption('#monthSelect', '2026-09');
  await page.locator('#t_products').click();
  await expect(page.locator('#host')).toContainText('全商品 40品目');
  await expect(page.locator('#host')).not.toContainText('分析不可');
  await expect(page.locator('body')).toBeVisible();
});

test('シフトを音声相当の文章から確認後に登録できる', async ({ page }) => {
  await page.goto('/shift/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#shareCode')).toHaveValue('0096');

  const alias = await page.evaluate(() => (window as typeof window & {
    __shiftVoice: { parse: (text: string) => { staffName: string } };
  }).__shiftVoice.parse('9月20日、上山、17時から23時'));
  expect(alias.staffName).toBe('植山');

  await page.locator('#voiceText').fill('9月20日、植山、17時から23時');
  await page.locator('#parseBtn').click();
  await expect(page.locator('#voiceReview')).toContainText('9月20日、植山さん、17時から23時');

  const ueyama = page.locator('#tbl tbody tr').filter({ hasText: '植山' });
  await expect(ueyama.getByRole('button', { name: '17-23' })).toHaveCount(0);
  await page.locator('#voiceConfirm').click();
  await expect(page.locator('#voiceStatus')).toContainText('シフトを登録しました');
  await expect(ueyama.getByRole('button', { name: '17-23' })).toHaveCount(1);

  await page.locator('#voiceText').fill('9月21日、知らない人、夜');
  await page.locator('#parseBtn').click();
  await expect(page.locator('#voiceStatus')).toContainText('登録済みのスタッフ名が見つかりません');
});

test('404 fallback', async ({ page }) => {
  const response = await page.goto('/404.html');
  expect(response?.status()).toBeLessThan(400);
});
