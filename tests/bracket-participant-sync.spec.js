const { test, expect } = require('@playwright/test');

test('manual bracket placement writes the participant drawing number', async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(function () {
    var participants = [];
    for (var i = 1; i <= 16; i += 1) {
      participants.push({
        id: 'row-' + i,
        slot: i,
        drawingNumber: null,
        name: 'Player ' + i,
        hc: 'HC 3B',
        hcCustom: '',
        status: ''
      });
    }

    localStorage.setItem('bilpos_tournament', JSON.stringify({ size: 16 }));
    localStorage.setItem('bilpos_participants', JSON.stringify(participants));
    window.BilposStorage.saveBracket({
      bracket: window.BilposTournament.generateBracket(16, []),
      liveMatchIds: []
    });
  });
  await page.reload();
  await page.click('[data-section="bracket"]');
  await page.waitForSelector('.participant-select');
  await page.locator('.participant-select').first().selectOption('row-1');

  const drawingNumber = await page.evaluate(function () {
    return window.BilposStorage.loadParticipants().find(function (participant) {
      return participant.id === 'row-1';
    }).drawingNumber;
  });

  expect(drawingNumber).toBe(1);
  await page.locator('.participant-select').first().selectOption('');
  await page.locator('.participant-select').first().selectOption('row-2');
  const replacementNumbers = await page.evaluate(function () {
    return window.BilposStorage.loadParticipants().slice(0, 2).map(function (participant) {
      return participant.drawingNumber;
    });
  });
  expect(replacementNumbers).toEqual([null, 1]);
  await page.locator('.participant-select').nth(1).selectOption('row-3');
  const assignedNumbers = await page.evaluate(function () {
    return window.BilposStorage.loadParticipants().slice(1, 3).map(function (participant) {
      return participant.drawingNumber;
    });
  });
  expect(assignedNumbers).toEqual([1, 2]);

  await page.click('[data-section="participants"]');
  await expect(page.locator('.bracket-input').nth(0)).toHaveValue('');
  await expect(page.locator('.bracket-input').nth(1)).toHaveValue('1');
  await expect(page.locator('.bracket-input').nth(2)).toHaveValue('2');
});

test('participant detail edits refresh matching players in later rounds', async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(function () {
    var participants = [];
    for (var i = 1; i <= 16; i += 1) {
      participants.push({
        id: 'row-' + i,
        slot: i,
        drawingNumber: null,
        name: 'Player ' + i,
        hc: 'HC 3B',
        hcCustom: '',
        status: ''
      });
    }
    localStorage.setItem('bilpos_tournament', JSON.stringify({ size: 16 }));
    localStorage.setItem('bilpos_participants', JSON.stringify(participants));
    window.BilposStorage.saveBracket({
      bracket: window.BilposTournament.generateBracket(16, []),
      liveMatchIds: []
    });
  });
  await page.reload();
  await page.click('[data-section="bracket"]');
  await page.waitForSelector('.participant-select');
  await page.locator('.participant-select').nth(0).selectOption('row-1');
  await page.locator('.participant-select').nth(1).selectOption('row-2');
  await page.locator('.score-input').nth(0).fill('7');
  await page.locator('.score-input').nth(1).fill('3');
  await expect(page.locator('.participant-name').first()).toContainText('Player 1');

  await page.click('[data-section="participants"]');
  await page.locator('.name-input[data-row="1"]').fill('Updated Player 1');
  await page.locator('.hc-select[data-row="1"]').selectOption('HC 3N');
  await page.evaluate(function () {
    window.BilposApp.saveParticipantRow(1);
  });
  await page.click('[data-section="bracket"]');

  await expect(page.locator('.participant-name').first()).toContainText('Updated Player 1');
  await expect(page.locator('.participant-name').first()).toContainText('HC 3N');
});

test('LIVE is disabled while any score is present and enabled only when both are empty', async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(function () {
    var participants = [];
    for (var i = 1; i <= 16; i += 1) {
      participants.push({
        id: 'row-' + i,
        slot: i,
        drawingNumber: null,
        name: 'Player ' + i,
        hc: 'HC 3B',
        hcCustom: '',
        status: ''
      });
    }
    localStorage.setItem('bilpos_tournament', JSON.stringify({ size: 16 }));
    localStorage.setItem('bilpos_participants', JSON.stringify(participants));
    window.BilposStorage.saveBracket({
      bracket: window.BilposTournament.generateBracket(16, []),
      liveMatchIds: []
    });
  });
  await page.reload();
  await page.click('[data-section="bracket"]');
  await page.waitForSelector('.participant-select');
  await page.locator('.participant-select').nth(0).selectOption('row-1');
  await page.locator('.participant-select').nth(1).selectOption('row-2');

  const scores = page.locator('.score-input');
  const liveButton = page.locator('.live-btn').first();
  await expect(liveButton).toBeEnabled();
  await scores.nth(0).fill('7');
  await expect(liveButton).toBeDisabled();
  await scores.nth(1).fill('3');
  await expect(liveButton).toBeDisabled();
  await scores.nth(0).fill('');
  await expect(liveButton).toBeDisabled();
  await scores.nth(1).fill('');
  await expect(liveButton).toBeEnabled();
});
