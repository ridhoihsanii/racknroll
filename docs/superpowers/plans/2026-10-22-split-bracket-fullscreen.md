# Split Fullscreen Tournament Bracket Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a standalone fullscreen bracket page and render 64- and 128-player tournaments as balanced left/right trees converging on a center final, with fit-to-height and in-app zoom.

**Architecture:** Keep the current persisted bracket data and `BracketPage` state owner. Add a pure view-layout helper that partitions pre-final rounds without cloning or modifying matches, then render mirrored-direction round columns around the existing final match. Mount the same React bundle on a new `bracket.html` page that shares localStorage with `index.html`; add viewport-measured FIT and zoom controls in the page shell.

**Tech Stack:** React 18, JSX bundled with esbuild, CSS, browser localStorage, Node.js built-in test runner, Playwright.

## Global Constraints

- `bracket.html` is a standalone page separate from tournament setup and participant-list UI.
- For 64 players, each side represents 32 player slots; for 128 players, each side represents 64 player slots.
- The left tree flows toward the center; the right tree mirrors bracket flow without mirroring player text; both semifinals feed the centered final.
- Preserve the existing bracket match-card appearance, typography, colors, badges, controls, and connector style; change only spatial arrangement, inward connector direction on the right, and page placement.
- Names, handicaps, and scores shown in the brainstorming mockup are illustrative only; render saved data and empty-slot states, never fixed example content.
- Tournament sizes other than 64 and 128 retain the current single-direction layout.
- FIT displays the full bracket height without vertical page scrolling; horizontal scrolling remains available.
- In-app zoom-out clamps at FIT; zoom-in may introduce vertical scrolling. Browser-level zoom is not modified.
- Reuse existing localStorage keys, match IDs, score/winner logic, participant synchronization, and preview payload.
- Use existing React and esbuild dependencies; do not add dependencies.
- Push the completed implementation branch to `origin` after validation.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/components/bracketUtils.js` | Modify | Pure split-layout partitioning and FIT-scale helpers |
| `tests/bracket-react.test.js` | Modify | Unit coverage for balanced split layout, match identity, and zoom math |
| `src/components/BracketView.jsx` | Modify | Choose single-tree or split-tree presentation from bracket size |
| `src/components/RoundColumn.jsx` | Modify | Render round subset with global match indices and inward/outward connector direction |
| `src/components/FinalColumn.jsx` | Create | Render the existing final match centered between the two semifinal trees |
| `src/components/BracketPage.jsx` | Modify | Fullscreen shell, responsive FIT measurement, and zoom state |
| `src/components/Bracket.css` | Modify | Add mirrored connectors, center-final positioning, viewport shell, toolbar, and scaled canvas without restyling existing bracket cards |
| `index.html` | Modify | Link to the separate bracket page and stop mounting the bracket in the main-page section |
| `bracket.html` | Create | Standalone page loading the shared storage globals and bracket bundle |
| `src/entry.jsx` | Modify | Mount the bracket page and handle PREVIEW on the standalone page |
| `assets/js/app.js` | Modify | Remove obsolete same-page preview wiring if no remaining caller exists |
| `tests/app-events.test.js` | Modify | Replace the old in-page bracket-nav event expectation with navigation-compatible coverage |
| `tests/bracket-page.spec.js` | Create | Browser coverage for dedicated page, split display, shared storage, preview, FIT, and zoom |
| `assets/js/bracket.bundle.js`, `.js.map`, and `bracket.bundle.css` | Generate | Production bundle and extracted stylesheet from `npm run build` |

## Task 1: Partition split bracket data without mutating it

**Files:**
- Modify: `src/components/bracketUtils.js`
- Modify: `tests/bracket-react.test.js`

**Interfaces:**
- Produces `getSplitBracketLayout(bracket)`, returning `null` unless `bracket.size` is `64` or `128`, or the rounds do not contain a final and evenly divisible pre-final rounds.
- For eligible brackets, returns `{ leftRounds, rightRounds, final }`. Each side-round has `{ round, roundIdx, matchIndices }`; entries in `matchIndices` are original indices into the persisted round. `final` has `{ match, roundIdx, matchIdx: 0 }`.
- The helper must preserve match object identity and never mutate `bracket`.

- [ ] **Step 1: Write a synthetic bracket fixture and focused failing tests** in `tests/bracket-react.test.js`:

```js
function makeBracket(size) {
  var matchCounts = [];
  for (var count = size / 2; count >= 1; count /= 2) matchCounts.push(count);
  return {
    size: size,
    rounds: matchCounts.map(function(matchCount, roundIdx) {
      return Array.from({ length: matchCount }, function(_, matchIdx) {
        return { id: 'r' + roundIdx + 'm' + matchIdx, p1: null, p2: null };
      });
    })
  };
}

test('getSplitBracketLayout splits a 64-player bracket evenly and preserves match indices', () => {
  const bracket = makeBracket(64);
  const before = JSON.stringify(bracket);
  const layout = utils.getSplitBracketLayout(bracket);

  assert.ok(layout);
  assert.equal(layout.leftRounds[0].round.length, 16);
  assert.equal(layout.rightRounds[0].round.length, 16);
  assert.equal(layout.leftRounds[0].matchIndices[0], 0);
  assert.equal(layout.rightRounds[0].matchIndices[0], 16);
  assert.equal(layout.leftRounds[layout.leftRounds.length - 1].round.length, 1);
  assert.equal(layout.rightRounds[layout.rightRounds.length - 1].round.length, 1);
  assert.equal(layout.final.match, bracket.rounds[bracket.rounds.length - 1][0]);
  assert.equal(layout.leftRounds[0].round[0], bracket.rounds[0][0]);
  assert.equal(JSON.stringify(bracket), before);
});

test('getSplitBracketLayout splits a 128-player bracket into 64 player slots per side', () => {
  const bracket = makeBracket(128);
  const layout = utils.getSplitBracketLayout(bracket);

  assert.ok(layout);
  assert.equal(layout.leftRounds[0].round.length * 2, 64);
  assert.equal(layout.rightRounds[0].round.length * 2, 64);
  assert.equal(layout.leftRounds[0].round.length, layout.rightRounds[0].round.length);
  assert.equal(layout.rightRounds[0].matchIndices[0], 32);
});

test('getSplitBracketLayout declines unsupported sizes and uneven rounds', () => {
  assert.equal(utils.getSplitBracketLayout({ size: 32, rounds: [[{}], [{}]] }), null);
  assert.equal(utils.getSplitBracketLayout({ size: 64, rounds: [[{}, {}, {}], [{}]] }), null);
});
```

The test file's current loader does not define `window`; use its existing tournament fixture/setup or build small synthetic round arrays when writing these tests. Do not add production globals to satisfy a test.

- [ ] **Step 2: Run the targeted test and confirm the expected missing-helper failure**

Run: `node --test --test-name-pattern "getSplitBracketLayout" tests/bracket-react.test.js`  
Expected: FAIL because `getSplitBracketLayout` is not exported.

- [ ] **Step 3: Implement and export the helper**

```js
function getSplitBracketLayout(bracket) {
  if (!bracket || (bracket.size !== 64 && bracket.size !== 128)) return null;
  if (!Array.isArray(bracket.rounds) || bracket.rounds.length < 2) return null;

  var finalRound = bracket.rounds[bracket.rounds.length - 1];
  if (!Array.isArray(finalRound) || finalRound.length !== 1) return null;

  function splitSide(side) {
    return bracket.rounds.slice(0, -1).map(function(round, roundIdx) {
      if (!Array.isArray(round) || round.length < 2 || round.length % 2 !== 0) return null;
      var midpoint = round.length / 2;
      var start = side === 'left' ? 0 : midpoint;
      var end = side === 'left' ? midpoint : round.length;
      return {
        round: round.slice(start, end),
        roundIdx: roundIdx,
        matchIndices: Array.from({ length: end - start }, function(_, i) { return start + i; })
      };
    });
  }

  var leftRounds = splitSide('left');
  var rightRounds = splitSide('right');
  if (leftRounds.some(function(round) { return !round; })
      || rightRounds.some(function(round) { return !round; })) return null;

  return {
    leftRounds: leftRounds,
    rightRounds: rightRounds,
    final: { match: finalRound[0], roundIdx: bracket.rounds.length - 1, matchIdx: 0 }
  };
}
```

- [ ] **Step 4: Run the targeted tests and confirm all split-layout assertions pass**

Run: `node --test --test-name-pattern "getSplitBracketLayout" tests/bracket-react.test.js`  
Expected: 3 passing tests.

- [ ] **Step 5: Commit the data-layout helper**

```powershell
git add -- src/components/bracketUtils.js tests/bracket-react.test.js
git commit -m "feat: partition large brackets into two sides" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

## Task 2: Render inward-facing trees and a shared center final

**Files:**
- Modify: `src/components/BracketView.jsx`
- Modify: `src/components/RoundColumn.jsx`
- Create: `src/components/FinalColumn.jsx`
- Modify: `src/components/Bracket.css`
- Create: initial split-view cases in `tests/bracket-page.spec.js`

**Interfaces:**
- `BracketView` uses `getSplitBracketLayout(bracket)` for sizes 64/128 and keeps its existing single-direction mapping for all other sizes.
- `RoundColumn` accepts optional `matchIndices` and `direction` (`'inward-right'` or `'inward-left'`). Local match positions control spacing and connector pairing; mapped original indices are passed to `MatchCard` so score and selection callbacks still target the original persisted match.
- `FinalColumn` accepts `{ final, participants, liveMatchIds, usedParticipantIds, onScoreChange, onSelectParticipant, onToggleLive }` and renders the original final match at its original round/match indices.

- [ ] **Step 1: Add browser tests for rendering real bracket data on the current bracket section**

Create `tests/bracket-page.spec.js`, visit `/index.html`, seed `BilposStorage` with real participant objects and generated 64-/128-player brackets, reload, then activate the existing bracket section. Assert:

```js
await expect(page.locator('.bracket-left-tree .match-card')).toHaveCount(31);
await expect(page.locator('.bracket-right-tree .match-card')).toHaveCount(31);
await expect(page.locator('.bracket-center-final .match-card')).toHaveCount(1);
await expect(page.locator('.bracket-final-label')).toHaveText('FINAL');
await expect(page.locator('.bracket-right-tree .participant-label').first()).toContainText('Player');
```

For 128, assert 63 cards per side and one center-final card. Use participant names generated by the test; do not hard-code mockup examples in application markup. Add a 32-player browser assertion that `.bracket-left-tree` is absent and the existing round columns remain rendered.

- [ ] **Step 2: Run the new split browser tests and verify they fail against the one-direction view**

Run: `npx playwright test tests/bracket-page.spec.js --grep "split|single-direction" --reporter=line`  
Expected: FAIL because the split-side containers and central final are not rendered yet.

- [ ] **Step 3: Partition rendering while preserving original callback indices**

In `BracketView`, define `sharedProps` from its existing props, then use it to render:

```jsx
var sharedProps = {
  participants: participants,
  liveMatchIds: liveMatchIds,
  usedParticipantIds: usedParticipantIds,
  onScoreChange: onScoreChange,
  onSelectParticipant: onSelectParticipant,
  onToggleLive: onToggleLive,
};

<div className="bracket-two-sided">
  <div className="bracket-left-tree">
    {layout.leftRounds.map(function(item) {
      return <RoundColumn key={item.roundIdx} round={item.round}
        roundIdx={item.roundIdx} totalRounds={bracket.rounds.length}
        matchIndices={item.matchIndices} direction="inward-right" {...sharedProps} />;
    })}
  </div>
  <FinalColumn final={layout.final} {...sharedProps} />
  <div className="bracket-right-tree">
    {layout.rightRounds.slice().reverse().map(function(item) {
      return <RoundColumn key={item.roundIdx} round={item.round}
        roundIdx={item.roundIdx} totalRounds={bracket.rounds.length}
        matchIndices={item.matchIndices} direction="inward-left" {...sharedProps} />;
    })}
  </div>
</div>
```

Keep the current `rounds.map(...)` path unchanged when the helper returns `null`. In `RoundColumn`, use the local array index for top/bottom connector pairing and vertical layout, but use `matchIndices[localIdx]` for `MatchCard.matchIdx` and event callbacks. Add direction-specific connector classes so right-side arms face the center; do not apply a transform that flips text. `FinalColumn` uses the final's original indices and the same `MatchCard`, so scores, LIVE, and winner handling remain unchanged. In CSS, add only layout and direction rules; retain existing match-card, participant-slot, typography, color, badge, button, and connector styling.

- [ ] **Step 4: Run split and legacy bracket tests**

Run: `npx playwright test tests/bracket-page.spec.js --grep "split|single-direction" --reporter=line`  
Expected: 3 passing browser cases for 64, 128, and a non-target size.

Run: `node --test tests/bracket-react.test.js`  
Expected: all bracket utility tests pass, including the new layout cases.

- [ ] **Step 5: Commit the two-sided rendering**

```powershell
git add -- src/components/BracketView.jsx src/components/RoundColumn.jsx src/components/FinalColumn.jsx src/components/Bracket.css tests/bracket-page.spec.js
git commit -m "feat: render split bracket around center final" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

## Task 3: Move bracket to a standalone page and preserve PREVIEW

**Files:**
- Modify: `index.html`
- Create: `bracket.html`
- Modify: `src/entry.jsx`
- Modify: `assets/js/app.js`
- Modify: `tests/app-events.test.js`
- Modify: `tests/bracket-page.spec.js`

**Interfaces:**
- `bracket.html` provides `#bracket-react-root` and `#btn-preview-bracket`, loads shared storage/tournament globals and the built bracket bundle.
- The index navigation has a normal anchor to `bracket.html`; it no longer contains a bracket section or bracket React root.
- PREVIEW sends `{ bracket, liveMatchIds, tournament }` through `BilposFirebase.openPreview(payload)` when Firebase is available; otherwise it opens `preview.html#<compressed-payload>` using `LZString` when loaded, matching current behavior.

- [ ] **Step 1: Write failing navigation and shared-storage browser tests**

Assert that clicking the index page's Bracket link navigates to `/bracket.html`, that the new page has the bracket root and PREVIEW button but no setup/participant section, and that editing a score updates `BilposStorage.loadBracket()` from the new page. Assert browser back returns to `/index.html`.

Add a PREVIEW test that stubs `window.open`, clicks PREVIEW, and verifies the opened URL starts with `preview.html#` and decodes to the current stored bracket, LIVE IDs, and tournament settings.

- [ ] **Step 2: Run the targeted tests and confirm they fail before page integration**

Run: `npx playwright test tests/bracket-page.spec.js --grep "navigation|shared storage|PREVIEW" --reporter=line`  
Expected: FAIL because `bracket.html` and the standalone navigation are not present.

- [ ] **Step 3: Add the standalone document and update index navigation**

Create `bracket.html` with viewport metadata, the existing theme and bracket CSS, a compact toolbar (`PREVIEW`, FIT, zoom-out, zoom-in), and only `#bracket-react-root` as the main content. Reuse existing match-card and participant-slot styling without redesigning their appearance. Load the same-origin `storage.js` and `tournament.js` before `assets/js/bracket.bundle.js`; load the same LZString/Firebase preview dependencies that the current page uses when available. Add an anchor from `index.html` to `bracket.html`; remove `section-bracket`, its preview button, and its bracket root from index. Remove the bracket CSS/bundle script from index if they are no longer used there.

- [ ] **Step 4: Move preview wiring to the dedicated bracket entry point**

In `src/entry.jsx`, after mounting, attach the PREVIEW handler to `#btn-preview-bracket` and preserve the existing payload and Firebase/hash fallback. Remove the old click-preview handler from `assets/js/app.js`. Remove the obsolete in-page bracket-tab activation listener from `src/entry.jsx` and matching event listener from `BracketPage` only after confirming no other caller uses it. Update `tests/app-events.test.js` so it no longer expects a same-page bracket nav event; retain tests for participant, bracket, import, and score state changes.

- [ ] **Step 5: Run navigation, preview, and shared-storage browser tests**

Run: `npx playwright test tests/bracket-page.spec.js --grep "navigation|shared storage|PREVIEW" --reporter=line`  
Expected: all targeted browser tests pass.

Run: `node --test --test-name-pattern "size change dispatches bilpos:bracket-activated|bracket assignment rejects duplicate|bracket assignment cancels result" tests/app-events.test.js`  
Expected: the size-update event and both bracket-assignment tests pass; the removed in-page navigation event is covered by the Playwright navigation test.

- [ ] **Step 6: Commit the standalone page integration**

```powershell
git add -- index.html bracket.html src/entry.jsx src/components/BracketPage.jsx assets/js/app.js tests/app-events.test.js tests/bracket-page.spec.js
git commit -m "feat: move tournament bracket to standalone page" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

## Task 4: Fit bracket to laptop viewport and add bounded zoom-out

**Files:**
- Modify: `src/components/bracketUtils.js`
- Modify: `tests/bracket-react.test.js`
- Modify: `src/components/BracketPage.jsx`
- Modify: `src/components/Bracket.css`
- Modify: `bracket.html`
- Modify: `tests/bracket-page.spec.js`

**Interfaces:**
- Add `getFitScale(viewportHeight, contentHeight)` returning `1` when content already fits, otherwise `viewportHeight / contentHeight`, with invalid/non-positive inputs safely returning `1`.
- Add `clampZoom(zoom, fitZoom)` returning no less than the current FIT scale.
- `BracketPage` observes the unscaled canvas content and available viewport height with `ResizeObserver`, recalculates FIT on content/viewport changes, and exposes a zoom value relative to FIT to the standalone toolbar.

- [ ] **Step 1: Write unit tests for FIT and zoom-out clamping**

```js
test('getFitScale fits tall content but never enlarges content already in view', () => {
  assert.equal(utils.getFitScale(800, 1600), 0.5);
  assert.equal(utils.getFitScale(800, 400), 1);
  assert.equal(utils.getFitScale(0, 400), 1);
});

test('clampZoom never allows application zoom below the FIT scale', () => {
  assert.equal(utils.clampZoom(0.8, 1), 1);
  assert.equal(utils.clampZoom(1.2, 1), 1.2);
  assert.equal(utils.clampZoom(0.4, 0.5), 0.5);
});
```

- [ ] **Step 2: Run the targeted zoom tests and verify they fail because the helpers are missing**

Run: `node --test --test-name-pattern "getFitScale|clampZoom" tests/bracket-react.test.js`  
Expected: FAIL because these exports do not exist.

- [ ] **Step 3: Implement pure fit and zoom helpers**

```js
function getFitScale(viewportHeight, contentHeight) {
  var viewport = Number(viewportHeight);
  var content = Number(contentHeight);
  if (!Number.isFinite(viewport) || !Number.isFinite(content) || viewport <= 0 || content <= 0) return 1;
  return Math.min(1, viewport / content);
}

function clampZoom(zoom, fitZoom) {
  var requested = Number(zoom);
  var minimum = Number(fitZoom);
  if (!Number.isFinite(minimum) || minimum <= 0) minimum = 1;
  if (!Number.isFinite(requested)) requested = minimum;
  return Math.max(minimum, requested);
}
```

Export and test both helpers.

- [ ] **Step 4: Implement FIT measurement and controls**

Use refs for the scroll viewport and an unscaled bracket measurement element. A `ResizeObserver` observes the viewport and content; an effect computes `fitZoom` using the helpers and sets current zoom to FIT on initial load, bracket-size changes, or viewport resizing while the user is still in FIT mode. Keep zoom-in as a multiplicative step above FIT; zoom-out applies `clampZoom(currentZoom / step, fitZoom)` and is disabled at FIT. FIT resets to the newly measured scale. Apply scaling to an inner bracket layer with transform origin at the upper-left, and explicitly size the outer scaled layer from the unscaled dimensions so horizontal/vertical scroll extents match the transformed content. Hide vertical overflow in FIT and allow it when zoom exceeds FIT; retain horizontal overflow in both modes.

- [ ] **Step 5: Verify browser layout and zoom behaviors**

Add tests asserting:

```js
await expect(page.locator('.bracket-scroll-container')).toHaveCSS('overflow-x', 'auto');
await expect(page.locator('.bracket-page')).toHaveCSS('height', '800px');
await expect(page.locator('#btn-zoom-out')).toBeDisabled();
await page.locator('#btn-zoom-in').click();
await expect(page.locator('.bracket-page')).toHaveAttribute('data-zoom-mode', 'zoomed');
await expect(page.locator('#btn-zoom-out')).toBeEnabled();
await page.locator('#btn-fit').click();
await expect(page.locator('#btn-zoom-out')).toBeDisabled();
```

Also set viewport heights to 800 and 700 and verify FIT recomputes without vertical page scrolling. Use the full-page document's `scrollHeight` and `clientHeight` for the no-vertical-scroll assertion in FIT; verify the bracket canvas can scroll horizontally.

- [ ] **Step 6: Run targeted zoom tests and commit**

Run: `node --test --test-name-pattern "getFitScale|clampZoom" tests/bracket-react.test.js`  
Expected: 2 passing tests.

Run: `npx playwright test tests/bracket-page.spec.js --grep "FIT|zoom|viewport|horizontal" --reporter=line`  
Expected: all targeted layout tests pass.

```powershell
git add -- src/components/bracketUtils.js tests/bracket-react.test.js src/components/BracketPage.jsx src/components/Bracket.css bracket.html tests/bracket-page.spec.js
git commit -m "feat: fit bracket to fullscreen viewport" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

## Task 5: Build, run regression suites, and push release branch

**Files:**
- Generate: `assets/js/bracket.bundle.js`
- Generate: `assets/js/bracket.bundle.js.map`
- Validate: all changed source and browser/unit tests

- [ ] **Step 1: Build the production bundle**

Run: `npm run build`  
Expected: esbuild exits with code 0 and writes `assets/js/bracket.bundle.js`, `assets/js/bracket.bundle.js.map`, and `assets/js/bracket.bundle.css`.

- [ ] **Step 2: Run focused unit and browser suites**

Run: `node --test tests/bracket-react.test.js`  
Expected: all bracket utility tests pass.

Run: `node --test --test-name-pattern "saveParticipantRow synchronizes name and handicap metadata across every bracket round|saveParticipantRow syncs a cleared custom handicap" tests/app.test.js`  
Expected: both participant-detail synchronization tests pass.

Run: `node --test --test-name-pattern "bracket assignment rejects duplicate|bracket assignment cancels result" tests/app-events.test.js`  
Expected: both bracket-assignment tests pass.

Run: `npx playwright test tests/bracket-page.spec.js tests/bracket-participant-sync.spec.js --reporter=line`  
Expected: all targeted browser tests pass, including existing participant sync, score/LIVE rules, and continuous typing focus.

- [ ] **Step 3: Check generated files and diff integrity**

Run: `git diff --check; git status --short`  
Expected: no whitespace errors; only the planned source, test, and generated bundle files are modified. Do not stage `.superpowers/brainstorm/` mockup artifacts.

- [ ] **Step 4: Commit the validated production bundle and tests**

```powershell
git add -- assets/js/bracket.bundle.js assets/js/bracket.bundle.js.map assets/js/bracket.bundle.css
git add -- tests/bracket-page.spec.js tests/bracket-participant-sync.spec.js
git commit -m "test: verify fullscreen split bracket" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

Stage only the test files changed by this implementation if unrelated test changes are present; do not indiscriminately commit unrelated files.

- [ ] **Step 5: Push the requested branch**

Run: `git push -u origin release/pemisahanBagan`  
Expected: the branch and its commits are published to `origin`.

Before claiming GitHub Pages has deployed, inspect the repository's Pages settings/workflow result. Pushing this branch makes it available for publication, but deployment is only confirmed if Pages is configured to publish this branch or a workflow reports a successful deployment.
