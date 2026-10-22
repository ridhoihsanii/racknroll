const { test, expect } = require('@playwright/test');

async function seedTournament(page, size, assignParticipants) {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate(function (setup) {
    var tournamentSize = setup.size;
    var participants = [];
    for (var i = 1; i <= tournamentSize; i += 1) {
      participants.push({
        id: 'player-' + i,
        slot: i,
        drawingNumber: i,
        name: 'Player ' + i,
        hc: 'HC 3B',
        hcCustom: '',
        status: ''
      });
    }
    localStorage.setItem('bilpos_tournament', JSON.stringify({ size: tournamentSize }));
    localStorage.setItem('bilpos_participants', JSON.stringify(participants));
    window.BilposStorage.saveBracket({
      bracket: window.BilposTournament.generateBracket(
        tournamentSize,
        setup.assignParticipants ? participants : []
      ),
      liveMatchIds: []
    });
  }, { size: size, assignParticipants: assignParticipants !== false });
  await page.reload();
  await page.locator('a[href="bracket.html"]').click();
}

test('64-player bracket renders balanced left and right trees around final', async ({ page }) => {
  await seedTournament(page, 64);

  await expect(page.locator('.bracket-left-tree .match-card')).toHaveCount(31);
  await expect(page.locator('.bracket-right-tree .match-card')).toHaveCount(31);
  await expect(page.locator('.bracket-center-final .match-card')).toHaveCount(1);
  await expect(page.locator('.bracket-final-label')).toHaveText('FINAL');
  await expect(page.locator('.bracket-left-tree .has-left-arm').first()).toBeVisible();
  await expect(page.locator('.bracket-right-tree .flow-left.has-right-arm').first()).toBeVisible();
  await expect(page.locator('.bracket-right-tree .round-column').last()
    .locator('.participant-select').first()).toHaveValue('player-33');
});

test('128-player bracket renders balanced left and right trees around final', async ({ page }) => {
  await seedTournament(page, 128);

  await expect(page.locator('.bracket-left-tree .match-card')).toHaveCount(63);
  await expect(page.locator('.bracket-right-tree .match-card')).toHaveCount(63);
  await expect(page.locator('.bracket-center-final .match-card')).toHaveCount(1);
});

test('32-player bracket keeps the existing single-direction round layout', async ({ page }) => {
  await seedTournament(page, 32);

  await expect(page.locator('.bracket-left-tree')).toHaveCount(0);
  await expect(page.locator('.bracket-view .round-column')).toHaveCount(5);
});

test('bracket navigation opens a dedicated page and browser back returns to setup', async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await page.locator('a[href="bracket.html"]').click();

  await expect(page).toHaveURL(/\/bracket\.html$/);
  await expect(page.locator('#bracket-react-root')).toBeVisible();
  await expect(page.locator('#btn-preview-bracket')).toBeVisible();
  await expect(page.locator('#section-setup, #section-participants')).toHaveCount(0);

  await page.goBack();
  await expect(page).toHaveURL(/\/index\.html$/);
});

test('bracket page score edits persist into shared browser storage', async ({ page }) => {
  await seedTournament(page, 64);
  const scores = page.locator('.bracket-left-tree .round-column').first().locator('.score-input');
  await scores.nth(0).fill('5');
  await scores.nth(1).fill('2');

  await expect.poll(function () {
    return page.evaluate(function () {
      var bracket = window.BilposStorage.loadBracket().bracket;
      return [bracket.rounds[0][0].score1, bracket.rounds[0][0].score2];
    });
  }).toEqual([5, 2]);
});

test('right-side participant placement persists its original bracket position', async ({ page }) => {
  await seedTournament(page, 64, false);
  const rightOpeningRound = page.locator('.bracket-right-tree .round-column').last();
  await rightOpeningRound.locator('.participant-select').first().selectOption('player-33');

  await expect.poll(function () {
    return page.evaluate(function () {
      return window.BilposStorage.loadParticipants().find(function (participant) {
        return participant.id === 'player-33';
      }).drawingNumber;
    });
  }).toBe(33);
});

test('PREVIEW opens the existing hash payload from the dedicated page', async ({ page }) => {
  await seedTournament(page, 64);
  const firebasePreviewUrl = await page.evaluate(function () {
    return window.BilposFirebase.getPreviewUrl('preview-test');
  });
  expect(firebasePreviewUrl).toMatch(/\/preview\.html\?id=preview-test$/);

  await page.evaluate(function () {
    window.BilposFirebase = null;
    window.__openedPreviewUrl = null;
    window.open = function (url) {
      window.__openedPreviewUrl = url;
    };
  });
  await page.locator('#btn-preview-bracket').click();

  const payload = await page.evaluate(function () {
    var url = window.__openedPreviewUrl;
    var serialized = window.LZString.decompressFromEncodedURIComponent(url.split('#')[1]);
    return { url: url, payload: JSON.parse(serialized) };
  });
  expect(payload.url).toMatch(/^preview\.html#/);
  expect(payload.payload.bracket).toEqual(await page.evaluate(function () {
    return window.BilposStorage.loadBracket().bracket;
  }));
  expect(payload.payload.tournament.size).toBe(64);
  expect(payload.payload.liveMatchIds).toEqual([]);
});

test('FIT keeps the bracket within the viewport and zoom controls stop at FIT', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedTournament(page, 64);

  await expect(page.locator('.bracket-page')).toHaveCSS('height', '800px');
  await expect(page.locator('#btn-zoom-out')).toBeDisabled();
  await expect.poll(function () {
    return page.evaluate(function () {
      return document.documentElement.scrollHeight <= document.documentElement.clientHeight;
    });
  }).toBe(true);

  await page.locator('#btn-zoom-in').click();
  await expect(page.locator('.bracket-page')).toHaveAttribute('data-zoom-mode', 'zoomed');
  await expect(page.locator('#btn-zoom-out')).toBeEnabled();
  await expect(page.locator('main.bracket-page-content')).toHaveCSS('overflow-x', 'auto');
  expect(await page.locator('main.bracket-page-content').evaluate(function (element) {
    return element.scrollWidth > element.clientWidth;
  })).toBe(true);
  expect(await page.locator('main.bracket-page-content').evaluate(function (element) {
    return element.scrollHeight > element.clientHeight;
  })).toBe(true);

  await page.locator('#btn-zoom-out').click();
  await expect(page.locator('.bracket-page')).toHaveAttribute('data-zoom-mode', 'fit');
  await expect(page.locator('#btn-zoom-out')).toBeDisabled();
  await page.locator('#btn-zoom-in').click();
  await page.locator('#btn-fit').click();
  await expect(page.locator('.bracket-page')).toHaveAttribute('data-zoom-mode', 'fit');
  await expect(page.locator('#btn-zoom-out')).toBeDisabled();
  await page.setViewportSize({ width: 1280, height: 700 });
  await expect.poll(function () {
    return page.evaluate(function () {
      return document.documentElement.scrollHeight <= document.documentElement.clientHeight;
    });
  }).toBe(true);
  await expect(page.locator('.bracket-page')).toHaveCSS('height', '700px');
});
