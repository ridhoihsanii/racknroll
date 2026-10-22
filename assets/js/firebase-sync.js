/* firebase-sync.js
 * Menyimpan bracket ke Firebase RTDB sehingga URL preview menjadi pendek
 * (preview.html?id=<shortId>) dan real-time di semua perangkat.
 */
(function () {
  var FIREBASE_CONFIG = {
    apiKey:            'AIzaSyA6h6oCHrKixtZMEyqufpaZsaBrdrtBL1Y',
    authDomain:        'bilpos-tournament.firebaseapp.com',
    databaseURL:       'https://bilpos-tournament-default-rtdb.firebaseio.com',
    projectId:         'bilpos-tournament',
    storageBucket:     'bilpos-tournament.firebasestorage.app',
    messagingSenderId: '1016029844462',
    appId:             '1:1016029844462:web:159e221b47c584eed0b4ff'
  };

  var PREVIEW_ID_KEY = 'bilpos_preview_id';
  var db = null;

  /* ── ID pendek unik per-browser (8-10 karakter) ─────────────────── */
  function getOrCreatePreviewId() {
    var id = localStorage.getItem(PREVIEW_ID_KEY);
    if (!id) {
      id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      localStorage.setItem(PREVIEW_ID_KEY, id);
    }
    return id;
  }

  /* ── URL preview pendek ─────────────────────────────────────────── */
  function getPreviewUrl(id) {
    var href = window.location.href;
    var base = href.split('?')[0].split('#')[0];
    base = base.replace(/(?:index|bracket)\.html$/, '').replace(/\/+$/, '');
    return base + '/preview.html?id=' + id;
  }

  /* ── Inisialisasi Firebase (idempotent) ─────────────────────────── */
  function initFirebase() {
    if (typeof firebase === 'undefined') return false;
    try {
      if (!firebase.apps || firebase.apps.length === 0) {
        firebase.initializeApp(FIREBASE_CONFIG);
      }
      db = firebase.database();
      return true;
    } catch (e) {
      console.warn('[BilposFirebase] init error:', e);
      return false;
    }
  }

  /* ── Simpan ke Firebase, buka tab preview ───────────────────────── */
  function openPreview(payloadObj) {
    var id  = getOrCreatePreviewId();
    var url = getPreviewUrl(id);

    if (!db && !initFirebase()) {
      // Fallback: hash-based URL (URL panjang)
      var json = JSON.stringify(payloadObj);
      var compressed = window.LZString
        ? LZString.compressToEncodedURIComponent(json)
        : encodeURIComponent(json);
      window.open('preview.html#' + compressed, '_blank');
      return;
    }

    payloadObj.updatedAt = Date.now();
    db.ref('brackets/' + id).set(payloadObj, function (err) {
      if (err) {
        console.warn('[BilposFirebase] write error:', err);
      }
      window.open(url, '_blank');
    });
  }

  /* ── Auto-sync saat bracket disimpan (setelah preview dibuka ≥1x) ─ */
  function hookSaveBracket() {
    if (!window.BilposStorage || typeof BilposStorage.saveBracket !== 'function') return;
    var original = BilposStorage.saveBracket.bind(BilposStorage);
    BilposStorage.saveBracket = function (data) {
      original(data);
      // Hanya sync ke Firebase jika preview sudah pernah dibuka (ID sudah ada)
      var id = localStorage.getItem(PREVIEW_ID_KEY);
      if (!id) return;
      if (!db && !initFirebase()) return;
      var tournament = BilposStorage.loadTournament ? BilposStorage.loadTournament() : {};
      db.ref('brackets/' + id).set({
        bracket:      data.bracket      || data,
        liveMatchIds: data.liveMatchIds || [],
        tournament:   tournament,
        updatedAt:    Date.now()
      });
    };
  }

  /* ── Expose API ─────────────────────────────────────────────────── */
  window.BilposFirebase = {
    init:              initFirebase,
    openPreview:       openPreview,
    getPreviewUrl:     getPreviewUrl,
    getOrCreatePreviewId: getOrCreatePreviewId
  };

  /* Auto-init jika Firebase SDK sudah dimuat */
  if (typeof firebase !== 'undefined') {
    initFirebase();
    hookSaveBracket();
  } else {
    /* Tunggu script Firebase selesai dimuat */
    window.addEventListener('load', function () {
      if (typeof firebase !== 'undefined') {
        initFirebase();
        hookSaveBracket();
      }
    });
  }
})();
