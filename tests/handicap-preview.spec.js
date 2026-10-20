const { test, expect } = require('@playwright/test');

test('participant HC dropdown exposes the requested presets and custom input', async ({ page }) => {
  await page.goto('/index.html');

  const select = page.locator('.hc-select').first();
  await expect(select.locator('option')).toHaveText([
    '— HC —',
    'HC Pemula',
    'HC 3SB',
    'HC 3B',
    'HC 3N',
    'HC 3A',
    'Custom'
  ]);

  await select.selectOption('HC 3SB');
  await expect.poll(async function () {
    return page.evaluate(function () {
      var participants = JSON.parse(localStorage.getItem('bilpos_participants') || '[]');
      var participant = participants.find(function (item) { return item.id === 'row-1'; });
      return participant ? participant.hc : '';
    });
  }).toBe('HC 3SB');
  await page.reload();
  await expect(page.locator('.hc-select').first()).toHaveValue('HC 3SB');

  await page.locator('.hc-select').first().selectOption('custom');
  await expect(page.locator('.hc-custom-input').first()).toBeVisible();
});

test('preview title stays branded when tournament venue is Billiard Positif', async ({ page }) => {
  await page.goto('/preview.html');
  await expect(page.locator('#preview-title')).toHaveText('Rack N Roll Bagan Tournament');
  await expect(page).toHaveTitle('Rack N Roll Bagan Tournament — Bracket Preview');

  const hash = await page.evaluate(function () {
    var payload = {
      tournament: { venue: 'Billiard Positif' },
      bracket: { rounds: [] },
      liveMatchIds: []
    };
    return LZString.compressToEncodedURIComponent(JSON.stringify(payload));
  });

  await page.goto('/preview.html#' + hash);
  await expect(page.locator('#preview-title')).toHaveText('Rack N Roll Bagan Tournament');
  await expect(page).toHaveTitle('Rack N Roll Bagan Tournament — Bracket Preview');
});
