const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const indexPath = path.join(process.cwd(), 'index.html');

function readIndex() {
  assert.ok(fs.existsSync(indexPath), 'index.html should exist');
  return fs.readFileSync(indexPath, 'utf8');
}

function assertContainsAll(source, snippets) {
  snippets.forEach((snippet) => {
    assert.ok(source.includes(snippet), `index.html is missing: ${snippet}`);
  });
}

test('index.html provides the SPA shell and required asset loading', () => {
  const source = readIndex();

  assertContainsAll(source, [
    '<!DOCTYPE html>',
    '<html lang="id"',
    '<meta charset="UTF-8"/>',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>',
    '<meta name="theme-color" content="#1A1214"/>',
    '<link rel="stylesheet" href="assets/css/style.css">',
    '<link rel="stylesheet" href="assets/js/bracket.bundle.css">',
    '<script src="assets/js/storage.js"></script>',
    '<script src="assets/js/tournament.js"></script>',
    '<script src="assets/js/ui.js"></script>',
    '<script src="assets/js/app.js"></script>',
    '<script src="assets/js/nav-enhance.js"></script>',
    '<script src="assets/js/bracket.bundle.js"></script>'
  ]);
});

test('index.html includes all current sections, nav items, and DOM ids', () => {
  const source = readIndex();

  assertContainsAll(source, [
    'id="toast-container"',
    'id="themeToggle"',
    'id="section-dashboard"',
    'id="section-setup"',
    'id="section-participants"',
    'id="section-bracket"',
    'data-section="dashboard"',
    'data-section="setup"',
    'data-section="participants"',
    'data-section="bracket"',
    'id="stat-bayar-cash"',
    'id="stat-transfer"',
    'id="stat-total-bayar"',
    'id="stat-belum-bayar"',
    'id="input-size"',
    'id="input-fee"',
    'id="participant-table"',
    'id="participant-tbody"',
    'id="participant-search"',
    'id="btn-delete-all"',
    'id="btn-preview-bracket"',
    'id="bracket-react-root"'
  ]);
});

test('participant section exposes Excel, JSON backup controls and the Bracket column', () => {
  const source = readIndex();
  const participantSection = source.split('id="section-participants"')[1].split('id="section-bracket"')[0];
  const transferModuleIndex = source.indexOf('assets/js/excel-transfer.js');
  const appModuleIndex = source.indexOf('assets/js/app.js');

  assert.match(participantSection, /id="btn-export-excel"/);
  assert.match(participantSection, /id="btn-import-excel"/);
  assert.match(participantSection, /id="import-excel-input"/);
  assert.match(participantSection, /id="btn-export-json"/);
  assert.match(participantSection, /id="btn-import-json"/);
  assert.match(participantSection, /id="import-json-input"/);
  assert.match(participantSection, /<th[^>]*>BRACKET<\/th>/);
  assert.ok(transferModuleIndex >= 0);
  assert.ok(transferModuleIndex < appModuleIndex);
});

test('index.html advertises the Anteraja dark theme color', () => {
  assert.match(readIndex(), /<meta name="theme-color" content="#1A1214"\/>/);
});
