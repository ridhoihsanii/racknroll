# Split Tournament Bracket and Fullscreen Page — Design Spec

**Date:** 2026-10-22  
**Project:** BILPOS — Rack N Roll  
**Branch:** `release/pemisahanBagan`

## Goal

Provide a dedicated, laptop-screen-focused tournament bracket page and, for 64- and 128-player tournaments, split the bracket into balanced left and right trees that converge on a centered final. Keep participant, placement, score, and LIVE behavior backed by the existing shared browser storage.

## User-approved behavior

- The standalone page is `bracket.html`, separate from the setup and participant-list page.
- The bracket page contains the tournament bracket, in-app zoom controls, and the existing PREVIEW action; it does not include the setup or participant-list UI.
- The normal page links to the bracket page. Browser back returns to the previous page.
- The bracket fills the viewport height in FIT mode, with no vertical page scrolling. Horizontal scrolling remains available for wide brackets.
- FIT is the minimum zoom level and cannot be reduced further using in-app zoom-out. Zoom-in is allowed and may introduce vertical scrolling.
- FIT scales the bracket to the available viewport height. At 128 participants, the full tree may therefore appear small; zoom-in trades the overview for detail.
- This controls zoom inside the application only; it does not attempt to prevent browser-level zoom shortcuts.
- For 64 players, each side represents 32 player slots; for 128 players, each side represents 64 player slots.
- The left tree flows toward the center. The right tree mirrors the bracket flow, without mirroring or reversing player text. Both semifinal matches feed the centered final.
- Names, handicaps, and scores shown in the brainstorming mockup are illustrative only. The running page displays actual saved participants, handicap values, scores, and empty-slot states; it must not include the sample names or values from the mockup as fixed content.
- Tournament sizes other than 64 and 128 retain the existing single-direction bracket layout unless the existing UI already chooses otherwise.

## Architecture and data flow

`bracket.html` loads the existing shared styles, storage scripts, and React bracket bundle. It mounts the same bracket state owner and uses the same `localStorage` keys as the setup page. It does not introduce a second bracket model or transform persisted match data. Participant selection, drawing-number synchronization, scores, winner advancement, and LIVE state continue through the existing callbacks and persistence flow.

The existing bracket data is an elimination tree with rounds ordered from opening matches to final. For the two targeted sizes, the view partitions each pre-final round by match index into equal left and right halves. Each half renders those matches in their existing progression order; right-side connector arms point inward using a direction-specific presentation style. The last match in each side is its semifinal and is displayed adjacent to the center final. The final continues to reference the same match object and remains editable through the existing score controls.

The index page provides an entry point to `bracket.html`; browser navigation provides the return path, so the dedicated screen remains focused on the bracket and PREVIEW. PREVIEW continues to open the existing share/preview page and payload.

## Fullscreen layout and zoom

The dedicated page uses a viewport-height shell that reserves space for a compact toolbar and gives the remaining height to the bracket canvas. The canvas scrolls horizontally when the bracket is wider than the viewport. In FIT mode, a measured scale factor fits the bracket's full vertical layout into the canvas height and prevents vertical scrolling. Zoom-in applies an in-app scale above FIT and may allow vertical overflow/scrolling. Zoom-out clamps to the computed FIT scale. Recalculate FIT when the viewport, tournament size, or rendered bracket dimensions change.

The toolbar contains the page title, FIT/zoom controls, and PREVIEW. No unrelated setup, participant-list, or dashboard controls are displayed on the dedicated bracket page.

## Error and compatibility behavior

- Missing or invalid saved bracket state follows the current bracket initialization behavior; do not silently fabricate a different persisted bracket model.
- Unavailable browser storage should continue to surface through the existing storage/error handling rather than reporting a successful save.
- Existing preview URLs and payloads remain compatible.
- The split is presentation-only; stored round arrays, match IDs, participant IDs, scores, and winner relationships are not renumbered or rewritten to create the two visual trees.

## Validation

- Unit-test split partitioning for 64 and 128 sizes, including balanced counts, a single centered final, and unchanged ordering/identity of match objects.
- Verify sizes outside 64 and 128 keep the current single-tree rendering.
- Browser-test dedicated-page navigation, shared storage updates for participant placement and scores, left/right orientation, and PREVIEW.
- Browser-test FIT after initial render and viewport resize, horizontal scrolling, zoom-out clamping at FIT, and zoom-in overflow behavior.
- Run the relevant existing tests and `npm run build`.

## Publishing

Commit the implementation and its generated production bundle to `release/pemisahanBagan` and push that branch to `origin`. A branch push makes the changes available for publication workflows but does not by itself guarantee that GitHub Pages deploys from this branch; the repository's Pages source/workflow must target this branch or a deployment workflow must be run.
