# Handicap Options and Preview Title Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the participant handicap presets and fix the preview branding to Rack N Roll Bagan Tournament.

**Architecture:** Keep handicap preset recognition, dropdown labels, and stored values aligned in `assets/js/app.js`. Make the preview heading and browser title a fixed brand in `preview.html`, independent of tournament venue/name.

**Tech Stack:** Vanilla JavaScript, HTML, Node.js built-in test runner, Playwright.

## Global Constraints

- Show the handicap choices `HC Pemula`, `HC 3SB`, `HC 3B`, `HC 3N`, `HC 3A`, and `Custom`.
- Keep the empty `— HC —` option for participants without a selected handicap.
- Keep `Custom` connected to the existing free-text handicap input.
- Always display `Rack N Roll Bagan Tournament` as the preview heading and browser-tab title.
- Do not change saved tournament venue/name data or branding elsewhere in the application.

---

## File Structure

- `assets/js/app.js`: recognized handicap presets and participant-table option rendering.
- `preview.html`: fixed initial preview heading and branding applied to the page title.
- `tests/handicap-preview.spec.js`: browser-level checks for the exact dropdown and fixed preview title when old venue data is provided.

### Task 1: Add failing tests for requested options and preview branding

**Files:**
- Create: `tests/handicap-preview.spec.js`

- [x] **Step 1: Add a focused renderer test**

In `tests/handicap-preview.spec.js`, add this browser test:

```js
test('participant HC dropdown exposes the requested presets and custom input', async ({ page }) => {
  await page.goto('/index.html');
  const select = page.locator('.hc-select').first();
  await expect(select.locator('option')).toHaveText([
    '— HC —', 'HC Pemula', 'HC 3SB', 'HC 3B', 'HC 3N', 'HC 3A', 'Custom'
  ]);
  await select.selectOption('HC 3SB');
  await page.reload();
  await expect(page.locator('.hc-select').first()).toHaveValue('HC 3SB');
  await page.locator('.hc-select').first().selectOption('custom');
  await expect(page.locator('.hc-custom-input').first()).toBeVisible();
});
```

- [x] **Step 2: Add browser test for fixed preview branding**

In the same test file, load `/preview.html`, create a compressed hash payload with the page's `LZString.compressToEncodedURIComponent`, and navigate to `/preview.html#<hash>`. Use a payload containing `{ tournament: { venue: 'Billiard Positif' }, bracket: { rounds: [] }, liveMatchIds: [] }`. Assert both `#preview-title` and `document.title` use `Rack N Roll Bagan Tournament`, not the venue value.

- [x] **Step 3: Run the focused tests and verify they fail**

Run: `npx playwright test tests/handicap-preview.spec.js`

Expected: tests fail because the old presets and venue-derived title are still present. If Playwright cannot connect, start the repository's static server with `npm start` in another terminal, then rerun the browser test.

### Task 2: Update dropdown data and fixed preview branding

**Files:**
- Modify: `assets/js/app.js`
- Modify: `preview.html`
- Test: `tests/handicap-preview.spec.js`

- [x] **Step 1: Replace the recognized handicap preset list**

In both `getKnownHcValue` and `getCustomHcValue` in `assets/js/app.js`, replace the old preset list with `['HC Pemula', 'HC 3SB', 'HC 3B', 'HC 3N', 'HC 3A', 'custom']`. Preserve fallback-to-custom handling for values outside this list.

- [x] **Step 2: Render the requested options**

In `renderParticipantTable`, keep `<option value="">— HC —</option>`, render the five handicap presets in the requested order, and label the existing `custom` value as `Custom`. Keep the existing custom input and sentinel value behavior.

- [x] **Step 3: Fix preview branding**

In `preview.html`, set the initial `#preview-title` to `Rack N Roll Bagan Tournament`. In `applyPayload`, always set `#preview-title` to that text and set `document.title` to `Rack N Roll Bagan Tournament — Bracket Preview`, without reading `data.tournament.venue` or `data.tournament.name`.

- [x] **Step 4: Run focused tests**

Run: `npx playwright test tests/handicap-preview.spec.js`

Expected: all focused tests pass, including the case where the preview payload contains the old venue.

- [x] **Step 5: Run the existing related suites**

Run: `node --test tests/*.test.js`

Run: `npx playwright test tests/bracket-react.spec.js`

Expected: existing app and bracket behavior remains intact; all related tests pass.
