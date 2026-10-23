# Bilpos Anteraja Color Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Apply the Anteraja magenta/yellow palette and warm surfaces throughout Bilpos without changing layout, typography, branding, or behavior.

**Architecture:** Keep the current token-driven app stylesheet and update its palette in place. Update the standalone preview's inline design tokens separately, because it does not load the app stylesheet; update both bracket color sources and rebuild the checked-in React bundle.

**Tech Stack:** CSS, HTML, JavaScript, Node.js built-in test runner, esbuild.

## Global Constraints

- Use Anteraja magenta `#ED0677` as the primary accent and yellow `#FFCB05` as the secondary accent, with the warm dark and light surfaces from the Anteraja stylesheet.
- Apply the palette consistently to both light and dark themes, including static UI, bracket rendering, and the shareable preview.
- Preserve Bilpos layout, font, text, and branding. Keep semantic success and danger colors distinct from the brand accents.
- Keep the existing theme toggle and all application behavior unchanged.

---

## File Structure

- `assets/css/style.css` owns the main app's design tokens and static component colors.
- `index.html` owns the browser theme-color metadata and one inline-styled action button.
- `preview.html` owns a separate inline stylesheet and JavaScript colors for the shareable preview.
- `assets/js/bracket.js` owns dynamic colors for the non-React bracket renderer.
- `src/components/Bracket.css` owns React bracket colors; `npm run build` regenerates `assets/js/bracket.bundle.js` and `assets/js/bracket.bundle.css`.
- `tests/style.test.js` and `tests/index.test.js` are the existing design-contract tests.

## Task 1: Replace the Main App and Preview Palettes

**Files:**
- Modify: `tests/style.test.js`
- Modify: `tests/index.test.js`
- Modify: `assets/css/style.css`
- Modify: `index.html`
- Modify: `preview.html`

- [x] **Step 1: Add failing palette-contract tests**

In `tests/style.test.js`, add tests for the app and standalone preview palettes:

```js
test('style.css defines the Anteraja palette in both app themes', () => {
  const source = readStyleSheet();

  [
    '--anteraja-primary: #ED0677;',
    '--anteraja-secondary: #FFCB05;',
    '--bg: #1A1214;',
    '--bg: #FFFAFC;'
  ].forEach((token) => {
    assert.ok(source.includes(token), `missing palette token: ${token}`);
  });
});

test('preview.html uses the Anteraja light palette', () => {
  const previewPath = path.join(process.cwd(), 'preview.html');
  const source = fs.readFileSync(previewPath, 'utf8');

  assert.match(source, /--bg:\s*#FFFAFC;/);
  assert.match(source, /--accent:\s*#ED0677;/);
  assert.doesNotMatch(source, /#d97706|rgba\(217,\s*119,\s*6/);
});
```

In `tests/index.test.js`, change the expected `theme-color` fixture to:

```js
'<meta name="theme-color" content="#1A1214"/>',
```

Add a focused test in `tests/index.test.js` named `index.html advertises the Anteraja dark theme color` that asserts `readIndex()` matches `/<meta name="theme-color" content="#1A1214"\/>/`.

- [x] **Step 2: Run the focused tests and confirm the old theme fails**

Run: `node --test tests/style.test.js`

Expected: FAIL because the current app tokens and preview accent still use the old palettes.

Run: `node --test --test-name-pattern="Anteraja dark theme color" tests/index.test.js`

Expected: FAIL because `index.html` still advertises the old dark theme color.

Note: The unfiltered `tests/index.test.js` suite already has two unrelated baseline failures because its document title and description assertions do not match the current `index.html`. Do not change those unrelated assertions as part of this palette task.

- [x] **Step 3: Update the app stylesheet and HTML palettes**

In `assets/css/style.css`, use the Anteraja brand palette and surfaces:

```css
--anteraja-primary: #ED0677;
--anteraja-primary-dark: #C10561;
--anteraja-secondary: #FFCB05;
--anteraja-pink: #F6AABF;
--anteraja-blue: #496AAA;
--anteraja-maroon: #841945;
--anteraja-charcoal: #3B2C2F;
--anteraja-black: #1A1214;
--anteraja-dark: #241A1D;
--anteraja-surface: #2A1F22;
--anteraja-surface-2: #34262A;
```

Map the existing dark tokens and `--bg`/`--bg-alt` to the warm dark surfaces; map the light-theme tokens to `#FFFAFC`, `#FFF3F7`, `#FFFFFF`, `#FFF8FB`, and the Anteraja charcoal text values. Use magenta for primary accents and `#FFCB05` only for secondary highlights. Update every old yellow `rgba(250,204,21,...)` accent to a magenta tint, change primary-button text to white for contrast, and retain semantic green/red statuses.

In `index.html`, change `theme-color` to `#1A1214` and make the preview-button border/background/text use the app's new theme tokens rather than the old yellow literals.

In `preview.html`, update its independent `:root` palette to the Anteraja light surfaces, charcoal text, and magenta accent. Replace amber accent literals in buttons and inline JavaScript with magenta tints; change dark-blue bracket cards to warm surfaces. Keep gray connectors and green/red win, loss, and live indicators semantic.

- [x] **Step 4: Run the focused tests**

Run: `node --test tests/style.test.js`

Expected: PASS for the updated app and preview palette contracts.

Run: `node --test --test-name-pattern="Anteraja dark theme color" tests/index.test.js`

Expected: PASS for the new theme-color contract. The two unrelated baseline failures are skipped by the name filter.

## Task 2: Update Bracket Color Sources and Rebuild

**Files:**
- Modify: `tests/style.test.js`
- Modify: `assets/js/bracket.js`
- Modify: `src/components/Bracket.css`
- Regenerate: `assets/js/bracket.bundle.js`
- Regenerate: `assets/js/bracket.bundle.css`

- [x] **Step 1: Add a failing bracket-color assertion**

Extend `tests/style.test.js` to read both bracket source files and assert that the primary accent is used and the old yellow accent is absent:

```js
test('bracket sources use the Anteraja primary accent', () => {
  const bracketScript = fs.readFileSync(
    path.join(process.cwd(), 'assets', 'js', 'bracket.js'),
    'utf8'
  );
  const bracketStyles = fs.readFileSync(
    path.join(process.cwd(), 'src', 'components', 'Bracket.css'),
    'utf8'
  );
  const source = `${bracketScript}\n${bracketStyles}`;

  assert.match(source, /var\(--anteraja-primary\)/);
  assert.doesNotMatch(source, /#FACC15|EAB308|250,\s*204,\s*21/);
});
```

- [x] **Step 2: Run the focused test and confirm it fails**

Run: `node --test tests/style.test.js`

Expected: FAIL because the bracket sources still contain Bilpos yellow.

- [x] **Step 3: Update both bracket renderers**

In `src/components/Bracket.css`, change the round label and match-card hover accents to `var(--anteraja-primary)` and magenta tints. Preserve neutral connector lines and live-state red.

In `assets/js/bracket.js`, replace direct yellow RGB values and `var(--bilpos-yellow)` with magenta tints and `var(--anteraja-primary)` for bracket labels, cards, and controls. Preserve non-brand semantic colors.

- [x] **Step 4: Rebuild the checked-in React bundle**

Run: `npm run build`

Expected: esbuild completes successfully and regenerates `assets/js/bracket.bundle.js` and `assets/js/bracket.bundle.css` from `src/entry.jsx` and imported component styles.

- [x] **Step 5: Run focused tests and verify active files contain no old yellow accent**

Run: `node --test tests/style.test.js`

Expected: all style tests pass.

Run: `node --test --test-name-pattern="Anteraja dark theme color" tests/index.test.js`

Expected: the theme-color test passes.

Run: `rg -n "FACC15|EAB308|250,\\s*204,\\s*21|d97706|217,\\s*119,\\s*6" assets\\css\\style.css assets\\js\\bracket.js assets\\js\\bracket.bundle.css src\\components\\Bracket.css index.html preview.html`

Expected: no matches.

## Final Verification

- [x] Run `npm run build`.
- [x] Run `node --test tests/style.test.js`.
- [x] Run `node --test --test-name-pattern="Anteraja dark theme color" tests/index.test.js`.
- [x] Confirm the theme toggle still switches the main app between the warm dark and Anteraja light palettes.
- [x] Confirm the standalone preview uses the light Anteraja palette and the bracket retains semantic win/loss/live colors.
