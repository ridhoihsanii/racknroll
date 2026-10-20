# Handicap Options and Preview Title Design

**Date:** 2026-10-20  
**Scope:** Update participant handicap choices and the tournament preview branding.

## Requirements

- Show the handicap choices `HC Pemula`, `HC 3SB`, `HC 3B`, `HC 3N`, `HC 3A`, and `Custom`.
- Keep the empty `— HC —` option for participants without a selected handicap.
- Keep `Custom` connected to the existing free-text handicap input.
- Always display `Rack N Roll Bagan Tournament` as the preview heading and browser-tab title.
- Do not change saved tournament venue/name data or branding elsewhere in the application.

## Design

Update the participant table renderer and its recognized preset-value list in `assets/js/app.js` together, so selecting any listed handicap is saved as a preset and remains selected when the table is rendered again. Preserve the existing custom-value sentinel and free-text behavior. Values no longer offered as presets continue to use the existing fallback-to-custom behavior.

In `preview.html`, use the requested brand as the initial preview heading and set it as the fixed heading and document title when preview data is applied. Do not derive the preview brand from the tournament venue or name; retain those fields in the payload for all other uses.

## Validation

Add focused tests for the participant dropdown choices and fixed preview branding, and run the relevant Node and browser test suites available in the project.
