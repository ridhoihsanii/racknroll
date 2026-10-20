# Excel Bracket Transfer Design

**Date:** 2026-10-20  
**Project:** Rack N Roll Tournament System  
**Scope:** Expose Excel participant export/import and allow workbook round-tripping of participant slots and the complete bracket.

## Goals

- Add participant-list Export and Import buttons to the Rack N Roll participant section.
- Add a numeric Bracket field immediately after HC and before the row delete action.
- Map slot `1` to Match 1 top, slot `2` to Match 1 bottom, slot `3` to Match 2 top, slot `4` to Match 2 bottom, continuing in match order.
- Export and import participant data and the full bracket, including scores, winners/advancers, match status, and live-match state.
- Use Rack N Roll's HC and payment concepts rather than Anteraja's Divisi column.

## Workbook Format

The exported workbook contains two sheets.

### Peserta

Columns are ordered exactly as requested: `Pembayaran`, `Nama`, `HC`, `Bracket`, `Ukuran Tournament`. No. HP is intentionally omitted. Payment values represent the existing `cash`/`tf`/unpaid states. `Bracket` contains the participant's numeric first-round slot, or is blank when unassigned. Tournament size is included on participant rows.

### Bracket

Contains one row for each match in every round. Rows preserve round and match indexes, participant IDs and display data for both sides, scores, winner/advancer, match status, and whether the match is marked LIVE. Import reconstructs the stored bracket in round/match order so participants advanced into later rounds are retained rather than re-generated from the roster alone.

## Participant Bracket Assignment

Persist the numeric Bracket value as the participant's `drawingNumber`. Empty is permitted. A value must be an integer between `1` and the configured tournament size and must not duplicate another participant's slot. Invalid assignments are rejected with a visible message and do not alter the bracket or participant data.

Changing a valid assignment updates the first round from participant `drawingNumber` values using the existing tournament bracket generator. If stored match scores or winners exist, ask for confirmation before replacing the bracket; cancel leaves the prior value and bracket unchanged. Confirming rebuilds the bracket and clears prior results, while participants without a slot remain unassigned.

## Import Behavior

Import replaces the participant roster. Parse and validate all required workbook data before writing storage so malformed files or invalid bracket slot assignments cannot partially overwrite the current roster. Normalize payment states to existing Rack N Roll values and map `HC` as the participant handicap value.

When a `Bracket` sheet is present, reconstruct the full saved bracket from its rows, preserving later-round participants and results. Reconcile each later-round slot against the previous match's saved winner, correcting stale entrants only in pending matches; reject mismatches in matches that already have progress. A roster participant may replace a matching first-round BYE only when that match is still pending and has no score, winner, or LIVE state; this reconciles roster edits without discarding played results. If the sheet is absent, create a fresh bracket from roster slot assignments without scores or winners. Update the tournament size from the workbook while retaining other tournament settings. Refresh the participant table and bracket view after a successful import.

## Error Handling and Testing

- Show an error if the Excel library or selected file is unavailable, a required sheet/column is malformed, an assignment is duplicate/out of range, or match data cannot be reconstructed.
- Do not claim import success or mutate storage on an invalid workbook.
- Test exact participant sheet columns, numeric slot mapping and validation, replacement semantics, and round-trip of score/winner/advancer/LIVE information.
- Test the UI confirmation path when changing a slot after a match has a result.
