import React from 'react';
import { createRoot } from 'react-dom/client';
import BracketPage from './components/BracketPage';

var _root = null;

function mountBracket() {
  var rootEl = document.getElementById('bracket-react-root');
  if (!rootEl) return;
  if (!_root) {
    _root = createRoot(rootEl);
  }
  _root.render(React.createElement(BracketPage, { onPreview: openBracketPreview }));
}

function openBracketPreview() {
  var storage = window.BilposStorage;
  var saved = storage ? storage.loadBracket() : null;
  var tournament = storage ? storage.loadTournament() : {};
  var payload = {
    bracket: saved && saved.bracket ? saved.bracket : null,
    liveMatchIds: saved && Array.isArray(saved.liveMatchIds) ? saved.liveMatchIds : [],
    tournament: tournament
  };

  if (window.BilposFirebase) {
    window.BilposFirebase.openPreview(payload);
    return;
  }

  var compressed = window.LZString
    ? window.LZString.compressToEncodedURIComponent(JSON.stringify(payload))
    : encodeURIComponent(JSON.stringify(payload));
  window.open('preview.html#' + compressed, '_blank');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountBracket);
} else {
  mountBracket();
}
