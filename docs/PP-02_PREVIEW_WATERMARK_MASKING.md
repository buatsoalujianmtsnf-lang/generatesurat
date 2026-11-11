# PP-02 — Watermark dan Penyamaran Preview Surat

**Proyek:** Generate Suratku
**Tahap:** PP-02, lanjutan dari PP-00 dan PP-01
**Tanggal:** 11 November 2026

## Perubahan fungsional

1. **Feature flag default OFF.** index.html tetap memakai data-preview-protection="off". Pengaturan data-preview-protection-mode="strict" berlaku hanya bila flag utama diubah menjadi "on" oleh pengujian internal. Mode "standard" hanya menampilkan watermark.
2. **Watermark dinamis per halaman.** Lapisan #preview-protection-layer adalah sibling dari #surat-preview di dalam #preview-canvas-wrapper. Setiap .preview-protection-sheet menampilkan pola SVG transparan berulang: merek GENERATE SURATKU, label PRATINJAU, kode sesi anonim sementara, dan waktu lokal. Kode bukan identitas pengguna, bukan token keamanan, tidak disimpan dan tidak dikirim ke server.
3. **Masking ketika tab tersembunyi.** Saat visibilitychange menunjukkan dokumen hidden pada mode strict, layer langsung memakai kelas is-masked sehingga kertas ditutup bidang opaque dengan teks penjelas. Saat tab visible, kelas dihapus segera. Tindakan ini tidak dapat mendeteksi screenshot atau screen recorder OS dan tidak menjamin bahwa aplikasi external tidak dapat menangkap tampilan.
4. **Geometri multipage dan zoom.** Overlay mengikuti rectangle fisik setiap .surat-page melalui pengukuran koordinat relatif transform. Saat data-page-count=0, overlay lama dibersihkan dan tidak menutupi pagination yang belum siap. MutationObserver juga memantau atribut data-page-count agar sinkron sesudah pagination.
5. **Lifecycle dan performa.** PP-01 tetap menyediakan init(), refresh(), destroy(), dan getStatus(). Seluruh listener, observer, dan requestAnimationFrame dibersihkan ketika flag OFF. Watermark membentuk satu data SVG tile yang diulang, bukan banyak node teks atau polling terus-menerus.
6. **Status viewer.** Badge #preview-protection-status hanya terlihat ketika flag aktif dan dokumen sudah mempunyai halaman. Label dan tooltip menyebut watermark dan keterbatasan screenshot OS.
7. **Isolasi cetak dan PDF.** Modul tidak menambah child pada #surat-preview; PdfExport tetap mengambil preview.outerHTML. Pada print media, seluruh layer dan badge disembunyikan. SponsorExportGate dan endpoint PDF otoritatif tidak dimodifikasi.
8. **PWA.** Cache app-shell dinaikkan dari v58 ke v59 agar peranti offline menerima JS/CSS baru. Tidak ada dependensi produksi baru.

## Cara uji internal (tanpa mengubah konfigurasi berkas)

Jalankan perintah berikut di console browser pada halaman editor menggunakan **data dummy**:

~~~js
document.documentElement.dataset.previewProtection = 'on';
document.documentElement.dataset.previewProtectionMode = 'strict';
PreviewProtection.refresh();
// Uji perubahan zoom, semua halaman dan berpindah tab.
// Ubah menjadi watermark-only:
document.documentElement.dataset.previewProtectionMode = 'standard';
PreviewProtection.refresh();
// Rollback:
document.documentElement.dataset.previewProtection = 'off';
PreviewProtection.refresh();
~~~

Pengaturan ini hanya berlaku pada halaman yang sedang terbuka. Tidak ada toggle publik atau perubahan default pada produksi.

## Kontrak penerimaan PP-02

- Tanpa aktivasi, tidak ada badge, watermark, masking, maupun listener perlindungan tambahan.
- Setelah aktivasi, watermark transparan yang berulang terlihat pada setiap halaman Preview Surat; tidak muncul pada editor, beranda, dialog, atau dokumen final.
- Strict mode menyamarkan setiap kertas pada tab hidden dan melepas penyamaran saat kembali visible. Mode standard tetap menampilkan watermark tetapi tidak menggunakan mask.
- Tidak ada event global keyboard, clipboard, contextmenu, anti-DevTools polling, upload, atau pencatatan data siswa.
- 18 template (termasuk Notulensi Rapat), pagination DPU, mode fokus, zoom, kertas portrait/landscape, PWA offline dan render/reset cepat tetap kompatibel.
- Cetak/PDF tetap bersih dari layer watermark; otorisasi sponsor tetap berlaku.

## Validasi dan batasan

Unit/regression tests berada di tests/preview-protection-watermark.test.js, di samping suite PP-00/PP-01. GitHub Actions menjalankan pemeriksaan sintaks, TypeScript, tests, coverage, sponsor/operasional, dan dependency audit. **CI hijau tidak membuktikan pemblokiran screenshot/screen recorder, juga tidak menggantikan tes visual perangkat nyata dan perbandingan hasil cetak/PDF.** UAT manual untuk Chrome/Edge/Firefox/Safari, Android/iOS, fullscreen, dan dokumen panjang tetap gate PP-04.

## Rollback / operasi

Setel data-preview-protection="off" lalu jalankan PreviewProtection.refresh(); untuk rollback kode, revert PR PP-02 dan sinkronkan cache PWA. Jangan mengubah pengaturan Vercel atau menyalakan auto-deploy sebagai bagian dari tahap ini. Lanjut PP-03 setelah review PP-02; jangan klaim proteksi absolut.
