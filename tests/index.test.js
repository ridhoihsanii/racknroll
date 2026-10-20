const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const indexPath = path.join(process.cwd(), 'index.html');

function readIndex() {
  assert.ok(fs.existsSync(indexPath), 'index.html should exist');
  return fs.readFileSync(indexPath, 'utf8');
}

test('index.html provides the Bilpos SPA shell and required asset loading', () => {
  const source = readIndex();

  [
    '<!DOCTYPE html>',
    '<html lang="id">',
    '<meta charset="UTF-8"/>',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0"/>',
    '<meta name="description" content="BILPOS - Professional Billiard Tournament Management System by Billiard Positif"/>',
    '<meta name="theme-color" content="#0A0A0A"/>',
    '<title>BILPOS — Billiard Positif Tournament System</title>',
    '<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">',
    '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">',
    '<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">',
    '<link rel="stylesheet" href="assets/css/style.css">',
    '<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>',
    '<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>',
    '<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>',
    '<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>',
    '<script src="assets/js/storage.js"></script>',
    '<script src="assets/js/drawing.js"></script>',
    '<script src="assets/js/tournament.js"></script>',
    '<script src="assets/js/bracket.js"></script>',
    '<script src="assets/js/ui.js"></script>',
    '<script src="assets/js/app.js"></script>'
  ].forEach((snippet) => {
    assert.match(source, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
});

test('index.html includes all required sections, nav items, and DOM ids', () => {
  const source = readIndex();

  [
    'id="toast-container"',
    'id="bilpos-sidebar"',
    'id="sidebar-overlay"',
    'id="hamburger-btn"',
    'id="header-venue"',
    'id="header-status"',
    'id="header-round"',
    'id="stat-total"',
    'id="stat-cash"',
    'id="stat-tf"',
    'id="stat-unpaid"',
    'id="stat-size"',
    'id="stat-matches"',
    'id="stat-finished"',
    'id="stat-remaining"',
    'id="stat-venue-text"',
    'id="section-dashboard"',
    'id="section-setup"',
    'id="section-participants"',
    'id="section-bracket"',
    'id="section-statistics"',
    'id="section-export"',
    'id="section-settings"',
    'class="bilpos-section active"',
    'class="bilpos-section"',
    'data-section="dashboard"',
    'data-section="setup"',
    'data-section="participants"',
    'data-section="bracket"',
    'data-section="statistics"',
    'data-section="export"',
    'data-section="settings"',
    'id="input-venue"',
    'id="input-size"',
    'id="btn-save-setup"',
    'id="btn-generate-bracket"',
    'id="info-rounds"',
    'id="info-matches"',
    'id="info-status"',
    'id="participant-table"',
    'id="participant-tbody"',
    'id="participant-search"',
    'id="btn-sort-az"',
    'id="btn-sort-za"',
    'id="btn-draw-all"',
    'id="bracket-container"',
    'id="bracket-render-area"',
    'data-zoom="75"',
    'data-zoom="100"',
    'data-zoom="125"',
    'data-zoom="150"',
    'id="btn-center-bracket"',
    'id="btn-fullscreen-bracket"',
    'id="btn-print-bracket"',
    'id="stats-total"',
    'id="stats-cash"',
    'id="stats-tf"',
    'id="stats-unpaid"',
    'id="stats-matches"',
    'id="stats-finished"',
    'id="stats-remaining"',
    'id="stats-venue"',
    'id="stats-size"',
    'id="stats-rounds"',
    'id="stats-status"',
    'id="btn-export-json"',
    'id="btn-export-excel"',
    'id="btn-export-pdf"',
    'id="btn-print-bracket-2"',
    'id="import-json-input"',
    'id="import-excel-input"',
    'id="setting-zoom"',
    'id="btn-reset-all"'
  ].forEach((snippet) => {
    assert.match(source, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
});

test('participant section exposes Excel transfer controls and the Bracket column', () => {
  const source = readIndex();
  const participantSection = source.split('id="section-participants"')[1].split('id="section-bracket"')[0];
  const transferModuleIndex = source.indexOf('assets/js/excel-transfer.js');
  const appModuleIndex = source.indexOf('assets/js/app.js');

  assert.match(participantSection, /id="btn-export-excel"/);
  assert.match(participantSection, /id="btn-import-excel"/);
  assert.match(participantSection, /id="import-excel-input"/);
  assert.match(participantSection, /<th[^>]*>BRACKET<\/th>/);
  assert.ok(transferModuleIndex >= 0);
  assert.ok(transferModuleIndex < appModuleIndex);
});
