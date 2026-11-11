# PP-03 — Pengamanan Interaksi Preview Surat

**Aplikasi:** Generate Suratku  
**Tanggal:** 11 November 2026  
**Tahap:** PP-03, setelah PP-00 audit, PP-01 fondasi, dan PP-02 watermark/masking.

## Tujuan dan batas kemampuan

Menambahkan pembatasan perilaku *pointer* khusus pada isi Preview Surat untuk mengurangi upaya penyalinan gambar lewat drag dan menu klik kanan. **Ini bukan pemblokir screenshot atau screen recording sistem operasi.** Perangkat perekam, tangkapan layar OS, ekstensi, browser yang dimodifikasi dan kamera eksternal tetap berada di luar kontrol aplikasi web.

## Implementasi

1. **Flag utama tetap OFF:** `<html data-preview-protection="off" data-preview-protection-mode="strict">`. Tidak ada listener PP-03 atau perubahan perilaku saat fitur OFF. Tidak ada perubahan persisten pada data surat.
2. **Mode standard:** watermark PP-02 tetap terlihat; tidak ada masking tab dan **tidak ada pembatasan interaksi** PP-03.
3. **Mode strict:** watermark + penyamaran tab saat background + interaksi pointer terbatas:
   - `contextmenu` klik kanan, Ctrl-click macOS, dan menu pointer touch dicegah **hanya pada isi `#surat-preview`** (tidak pada toolbar, editor, input, tautan, tombol atau konten editable);
   - `dragstart` gambar/logo/SVG/canvas di dalam surat dicegah; seret seleksi teks **tidak** diblokir;
   - pintasan keyboard untuk menu konteks (Context Menu/Shift+F10) tetap dipertahankan untuk aksesibilitas;
   - pesan feedback singkat melalui `UI.toast()` dengan batas sekali per 5 detik, tanpa spam.
4. **Listener terlokalisasi:** hanya `preview.addEventListener('contextmenu', ...)` dan `preview.addEventListener('dragstart', ...)`. Tidak ada event keyboard, clipboard, print atau document-level contextmenu baru.
5. **Batas objek:** hanya target di dalam `#surat-preview` yang memenuhi kondisi media/konteks. Interaksi pada modal, panel editor, halaman beranda, kontrol zoom, daftar halaman, dan header tidak diubah.
6. **Mode berubah tanpa reload:** `PreviewProtection.refresh()` memasang atau melepas listener ketika flag atau mode berubah. `destroy()` memastikan cleanup idempoten. Status `getStatus().interactionsProtected` menunjukkan hanya apakah guard strict terpasang, **bukan** status bahwa screenshot berhasil dicegah.
7. **CSS screen-only:** `-webkit-user-drag:none` diterapkan hanya pada gambar preview saat flag ON dan mode bukan standard. Tidak ada `user-select:none` pada konten surat; semua teks dapat diseleksi/disalin agar aksesibilitas dan kerja pengguna tetap normal.
8. **Kualitas/operasional:** SW app-shell di-*bump* dari v59 ke v60; semua pengujian PWA relevan diperbarui. Tidak ada dependensi baru, perubahan database, endpoint, atau konfigurasi Vercel.

## Alur penggunaan internal dan rollback

Sebelum PP-04, fitur **tidak** diaktifkan melalui UI atau di produksi. Pengujian internal sementara:

```js
document.documentElement.dataset.previewProtection = 'on';
document.documentElement.dataset.previewProtectionMode = 'strict';
PreviewProtection.refresh();

// Mode watermark-only tanpa pembatasan klik kanan:
document.documentElement.dataset.previewProtectionMode = 'standard';
PreviewProtection.refresh();

// Rollback:
document.documentElement.dataset.previewProtection = 'off';
PreviewProtection.refresh();
```

Gunakan data dummy. Perubahan hanya berlaku pada tab yang sedang terbuka dan tidak dipersistensikan.

## Kontrak regresi

- PP-00: semua template dan pagination/zoom tidak berubah.
- PP-01: flag OFF tanpa event listener baru, lifecycle init/refresh/destroy tetap aman.
- PP-02: watermark dan masking strict tidak berubah.
- PP-03: klik kanan pointer dan drag media dibatasi secara lokal ketika strict; menu keyboard, copy/select, pintasan Ctrl/Cmd+P, Ctrl/Cmd+C, scroll dan interaksi non-preview tetap berjalan.
- Print dan PDF resmi tetap bersih dari watermark karena lapisan pelindung adalah sibling dari `#surat-preview`, dan aturan `@media print` menyembunyikannya.
- `SponsorExportGate` dan pemeriksaan receipt server tetap otoritatif.
- PWA offline memuat JS/CSS baru dan cache yang sesuai.

## Gate PP-04

CI unit/tipe/audit harus hijau. **Tetap wajib UAT browser sungguhan** (Chrome, Edge, Firefox, Safari; desktop/mobile; touch long-press; klik kanan; pembaca layar; 18 template; dokumen panjang; zoom/mode fokus; sponsor; hasil PDF dan cetak). Real-device UAT dan verifikasi screenshot/rekaman OS tidak dipenuhi hanya dengan lolos tes unit.

**Operasional:** Jangan merge PP-03 atau deploy tanpa instruksi berikutnya. Jangan mengubah status auto-deploy Vercel (tetap disabled).
