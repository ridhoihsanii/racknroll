const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function readStyleSheet() {
  const stylesheetPath = path.join(process.cwd(), 'assets', 'css', 'style.css');
  assert.ok(fs.existsSync(stylesheetPath), 'assets/css/style.css should exist');
  return fs.readFileSync(stylesheetPath, 'utf8');
}

test('style.css defines the Anteraja palette in both app themes', () => {
  const source = readStyleSheet();

  [
    '--anteraja-primary: #ED0677;',
    '--anteraja-secondary: #FFCB05;',
    '--bg: #1A1214;',
    '--bg: #FFFAFC;',
    '--transition: all 0.25s cubic-bezier(0.4,0,0.2,1);'
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
  assert.doesNotMatch(source, /#FACC15|EAB308|250,\s*204,\s*21|rgba\(2,\s*6,\s*23/);
  assert.match(
    bracketStyles,
    /\.participant-select option\s*\{\s*background-color:\s*var\(--surface\);\s*color:\s*var\(--text\);/
  );
});

test('style.css includes premium layout, component, and responsive sections', () => {
  const source = readStyleSheet();

  [
    '.bilpos-header',
    '.bilpos-sidebar',
    '.bilpos-main',
    '.bilpos-card',
    '.stat-card',
    '.btn-bilpos-primary',
    '.participant-table',
    '.bracket-container',
    '.match-card.match-live',
    '#toast-container',
    '.bilpos-form-group',
    '.empty-state',
    '.skeleton-row',
    '.ripple',
    '.bilpos-footer',
    '.export-btn-group',
    '.settings-item',
    '.bracket-container:fullscreen',
    '@media (max-width: 991.98px)',
    '@media (max-width: 575.98px)'
  ].forEach((selector) => {
    assert.match(source, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
});

test('style.css includes required interactive and animation details', () => {
  const source = readStyleSheet();

  [
    'backdrop-filter: blur(20px);',
    'background: linear-gradient(135deg, var(--anteraja-primary) 0%, var(--anteraja-primary-dark) 100%);',
    'box-shadow: var(--shadow-brand);',
    'position: sticky;',
    'animation: livePulse 2s ease-in-out infinite;',
    '@keyframes fadeIn',
    '@keyframes rippleAnim',
    '@keyframes livePulse',
    '@keyframes heartbeat',
    '@keyframes glow'
  ].forEach((snippet) => {
    assert.match(source, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
});
