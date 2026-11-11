# Pembatasan Zoom Halaman dan Pemulihan Scroll Preview Surat

**Tanggal:** 11 November 2026  
**Proyek:** Generate Suratku  
**Branch:** `fix/site-page-zoom-guard-mobile-preview-scroll`  
**Referensi:** PP-04 Browser UAT, PR #70.

## 1. Pembatasan zoom halaman

Tujuh dokumen HTML (`index.html`, Panduan, Panduan Cetak/PDF, FAQ, Tentang, Privasi dan Ketentuan) kini memasang:

- meta viewport `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no` untuk kebanyakan browser mobile.
- `js/page-zoom-guard.js` (same-origin), mengabaikan zoom halaman berbasis Ctrl/Meta + roda mouse/trackpad, Ctrl/Meta + `+`, `-` dan `0`, WebKit `gesturestart/gesturechange`, serta multi-touch `touchmove`. Listener terpasang hanya sekali setiap dokumen.
- Interaksi yang tidak terkait zoom, seperti scroll biasa, swipe satu jari, mengetik, Undo, Copy, klik dan navigasi, **tidak** diblokir.

**Penting:** pembatasan zoom di web adalah *best effort*. Browser tertentu, setelan aksesibilitas atau sistem operasi tetap dapat memperbesar halaman. Penggunaan `user-scalable=no` dapat mengurangi aksesibilitas, khususnya pengguna dengan gangguan penglihatan; perlu dievaluasi sebelum aktivasi untuk seluruh pengguna dan diuji dengan fitur pembesaran OS/pembaca layar. Bila prioritas aksesibilitas diutamakan, rollback pembatasan zoom halaman tanpa membatalkan perbaikan preview dapat dilakukan dengan mengembalikan meta viewport dan melepaskan `page-zoom-guard.js`.

## 2. Preview Surat dengan zoom yang bisa di-scroll

Akar masalah: `transform: scale(...)` pada wrapper kertas tidak mengubah ukuran layout dari flex container. Saat dimensi visual melampaui lebar mobile, sebagian kertas (khususnya sisi kiri pada transform origin tengah) berada di luar area scroll yang bisa dijangkau.

Perbaikan:

1. `#preview-scroll-stage` baru membungkus `#preview-canvas-wrapper`, tanpa masuk ke `#surat-preview` atau payload PDF.
2. Wrapper memiliki ukuran kertas natural dan `transform-origin: top left`. Stage memiliki lebar/tinggi **yang dihitung dari ukuran kertas × level zoom** beserta jarak 16px per sisi.
3. Stage terpusat ketika muat, tetapi jika melebihi viewport, kontainer `#preview-viewport` memiliki scroll horizontal ke **kedua tepi**.
4. Tinggi panel preview saat compact dibatasi sesuai tinggi viewport, sehingga stage dokumen tidak mendorong panel menjadi ribuan piksel dan scroll vertikal tetap aktif di area dokumen.
5. CSS cetak mengembalikan posisi dan transform ke layout natural; watermark/preview-protection tetap terisolasi.

## 3. Validasi

**GitHub Actions [run #43046568328](https://github.com/buatsoalujianmtsnf-lang/generatesurat/actions/runs/43046568328)**: **6/6 job SUCCESS**, **58 test files / 443 tests PASS**, audit dependensi tanpa kerentanan. UAT Chromium 4 viewport (desktop 1440×900, tablet 820×1180, mobile portrait 390×844, mobile landscape 844×390) **PASS**.

Browser UAT mencakup:

- 5 tingkat zoom: **35%, 65%, 100%, 150%, 250%**; ukuran stage sinkron, scrollLeft di kiri dan ujung kanan memperlihatkan seluruh lebar kertas.
- Kontrol Preview `+`/`−` tetap memodifikasi zoom dokumen tanpa mengubah `window.visualViewport.scale`.
- Event Ctrl+wheel, Ctrl+Plus dan Safari gesture disimulasikan di DOM dan dibatalkan; scroll normal tetap bisa dipakai.
- Navigasi multi-halaman, 18 template, keselarasan watermark, cetak Chromium dan payload PDF tetap lulus.
- Tes statis seluruh tujuh HTML dan unit `tests/page-zoom-and-preview-scroll.test.js`.

**Batas bukti:** uji perangkat fisik Chrome Android, Safari iOS/iPadOS, Firefox desktop, aksesibilitas magnifikasi, keyboard/pinch OS, dan panning di perangkat sentuh nyata belum dilakukan. Browser Chromium otomatis tidak membuktikan pembatasan zoom 100% lintas browser.

## 4. Operasional

- Cache PWA: `v64 → v65`, termasuk skrip pembatas zoom baru.
- Tidak ada migrasi basis data, perubahan sponsor, integrasi AdSense pihak ketiga, atau perubahan PDF.
- PR #70 masih **OPEN**, belum di-merge maupun dideploy. Auto-deploy Vercel tetap **OFF**.
