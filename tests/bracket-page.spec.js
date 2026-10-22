const { test, expect } = require('@playwright/test');

async function seedTournament(page, size) {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate(function (tournamentSize) {
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
      bracket: window.BilposTournament.generateBracket(tournamentSize, participants),
      liveMatchIds: []
    });
  }, size);
  await page.reload();
  await page.locator('[data-section="bracket"]').click();
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
