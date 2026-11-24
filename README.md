# RNR — Rack N Roll Tournament System Billiard

Aplikasi web untuk mengelola turnamen billiard: peserta, pembayaran, handicap, dan bracket single elimination. Tema Anteraja (pink/kuning), mode gelap & terang.

Live: https://ridhoihsanii.github.io/racknroll/

## Fitur
- Dashboard pembayaran (Cash / Transfer / belum bayar)
- Setup turnamen (ukuran bracket, biaya)
- List peserta: tambah, edit, cari, hapus (dengan konfirmasi)
- Bracket interaktif (React) + preview fullscreen yang dapat dibagikan
- Import/Export Excel, serta **Backup/Restore JSON**
- Mobile: tab bawah, tabel peserta ringkas, bracket per-ronde (swipe), tanpa zoom halaman (kecuali di preview)

## Menjalankan
```
npm ci
npm start        # http://127.0.0.1:8080
npm run build    # bangun assets/js/bracket.bundle.* dari src/
```

## Test
```
npm test         # unit test (node:test)
npx playwright install chromium
npx playwright test tests/mobile.spec.js --project=mobile
```
CI: `.github/workflows/test.yml`.

## Struktur
- `index.html`, `assets/js/*` — aplikasi utama (vanilla JS)
- `src/` — komponen bracket React (di-bundle dengan esbuild)
- `preview.html` — halaman preview bracket
