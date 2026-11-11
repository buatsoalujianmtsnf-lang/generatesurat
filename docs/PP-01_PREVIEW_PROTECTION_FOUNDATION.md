# PP-01 — Fondasi Perlindungan Preview Surat

**Proyek:** Generate Suratku · **Tanggal:** 11 November 2026  
**Sumber:** [PP-00 audit](PP-00_PREVIEW_PROTECTION_AUDIT_BASELINE.md)  
**Tujuan:** menyediakan modul kerangka noninvasif untuk PP-02 dan PP-03. Bukan fitur perlindungan screenshot yang sudah aktif.

## Keputusan implementasi

1. **Flag default OFF:** atribut HTML root \`data-preview-protection="off"\`. Nilai persis \`"on"\` dibutuhkan untuk mengaktifkan kerangka, sehingga salah ketik atau atribut hilang tetap menghasilkan OFF. Tidak ada pengaturan yang persisten di draft surat; toggle eksperimental hanya dengan perubahan atribut secara eksplisit dan \`PreviewProtection.refresh()\`. Jangan aktifkan pada produksi sebelum PP-02–PP-04.
2. **Isolasi isi surat:** \`#preview-protection-layer\` diletakkan sebagai **sibling** \`#surat-preview\` di dalam \`#preview-canvas-wrapper\`. Node yang berisi dokumen tidak dimodifikasi oleh modul. \`js/pdf-export.js\` tetap hanya mengirim \`#surat-preview.outerHTML\`; tidak ada watermark maupun overlay pada PDF.
3. **Lifecycle:** \`PreviewProtection.init()\` idempoten, \`refresh()\` dapat mengaktifkan/nonaktifkan ketika flag diubah, \`destroy()\` membatalkan RAF, memutus MutationObserver/ResizeObserver, melepas seluruh event listener dan unsubscribe State, lalu membersihkan kerangka.
4. **Pengukuran geometri:** setiap \`.surat-page\` (atau satu \`#surat-preview\` jika layout non-paginated sudah siap) mendapat node \`.preview-protection-sheet\` yang **transparan** dan \`pointer-events:none\`. Koordinat menggunakan getBoundingClientRect dikoreksi terhadap transform zoom wrapper; tidak memengaruhi flow layout atau scroll. Pada \`data-page-count="0"\` belum siap pagination: tidak memunculkan layer.
5. **Pemicu sinkronisasi:** MutationObserver pada DOM preview; ResizeObserver pada wrapper, viewport, dan preview; event perubahan template/restore/reset/zoom/settings dari State; window resize, fullscreenchange, dan visibilitychange. Seluruhnya didebounce per frame dengan requestAnimationFrame, tanpa polling. Listener hanya dibuat saat flag ON.
6. **Cakupan:** tidak ada keyboard/contextmenu/clipboard interception, pemblokiran screenshot, watermark, masking tab, pengambilan data pribadi, server endpoint, atau dependensi baru dalam PP-01. CSS hanya area screen, dan print rule eksplisit menyembunyikan kerangka.
7. **PWA:** stylesheet dan modul dicantumkan di SW precache; versi cache dinaikkan. **Tampilan default produksi tidak berubah.**

## Kontrak agar PP-02 dapat diteruskan

- Tambahkan isi watermark ke \`.preview-protection-sheet\`, bukan \`#surat-preview\`.
- Gunakan \`getStatus()\` untuk status non-sensitif, bukan untuk mengklaim screenshot terblokir.
- Semua 18 template saat ini (termasuk Notulensi Rapat) perlu diuji dalam pagination/zoom; catatan PP-00 mengaudit snapshot lebih lama dengan 17 template.
- Uji mobile, 50+ halaman, full-screen/fallback, render sangat cepat, reset/restore, hasil cetak/PDF dan sponsor sebelum menyalakan flag.
- **Jangan jalankan PP-02–PP-03 sekaligus tanpa gate baru.**

## Rollback

Set \`data-preview-protection="off"\` dan panggil \`PreviewProtection.refresh()\` atau reload halaman. Jika rilis bermasalah, rollback commit/PR PP-01 (tanpa migrasi basis data) dan pastikan PWA cache kembali konsisten.

## Bukti validasi

Tes kontrak dan unit berada di \`tests/preview-protection-foundation.test.js\`. Tes lama tetap dijalankan oleh Quality Checks. Browser UAT real-device, OS screenshot/recording, visual parity print/PDF tetap OPEN menuju PP-04. CI hijau bukan bukti bahwa aplikasi web mampu memblokir perekam layar sistem operasi.
