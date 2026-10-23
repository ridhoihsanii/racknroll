# Bilpos Anteraja Color Theme — Design Spec

**Date:** 2026-10-23  
**Status:** Approved by user

## Context

Bilpos currently uses a black-and-yellow palette, while the user's Anteraja project uses
Anteraja's magenta-and-yellow brand palette with warm dark surfaces and a lightly tinted
light theme. This change transfers the color theme only. Bilpos layout, typography, copy,
logos, and behavior remain unchanged.

## Requirements

1. Use Anteraja magenta `#ED0677` as the primary accent and yellow `#FFCB05` as the
   secondary accent, with the warm dark and light surfaces from the Anteraja stylesheet.
2. Apply the palette consistently to both light and dark themes, including static UI,
   bracket rendering, and the shareable preview.
3. Preserve Bilpos layout, font, text, and branding. Keep semantic success and danger
   colors distinct from the brand accents.
4. Keep the existing theme toggle and all application behavior unchanged.

## Design

Keep the existing token-driven Bilpos stylesheet and map its brand colors and surfaces to
the values used in `anterajaclub-project/assets/css/style.css`. The default dark theme
uses warm near-black surfaces; light mode uses near-white surfaces with a subtle pink tint.
Magenta replaces yellow as the primary action, navigation, focus, and decorative accent;
yellow remains a secondary highlight. Retain green success and red danger indicators.

Apply these colors across `assets/css/style.css`, the preview's color metadata and inline
styles, and any JavaScript or component stylesheet that sets bracket colors directly.
Where bracket styles are generated from source, update the source and rebuild its checked-in
bundle rather than editing generated output alone. Do not copy Anteraja layout or typography.

## Scope

Expected implementation surfaces are `assets/css/style.css`, `index.html`, `preview.html`,
bracket color sources such as `assets/js/bracket.js` and `src/components/Bracket.css`, and
the generated bracket bundle when its source changes. Update `tests/style.test.js` to assert
the new intentional palette. Do not change tournament logic, storage, routing, or data.

## Validation

- Run the project build if bracket source changes.
- Run `node --test tests/style.test.js tests/index.test.js`.
- Verify no Bilpos yellow accent remains in active UI code, including dynamic bracket styles.
- Confirm theme-toggle behavior and both palette modes remain intact.
