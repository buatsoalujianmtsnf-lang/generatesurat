# Perbaikan UI Panel Editor dan Navigasi Preview Surat

**Tanggal:** 11 November 2026  
**Aplikasi:** Generate Suratku  
**Cakupan:** editor drawer, toolbar Preview Surat, navigasi multi-halaman, pengujian regresi.

## Perubahan

1. **Kontrol buka/tutup editor dipindahkan dari navbar aplikasi** ke kontrol tunggal di area kerja `#editor-drawer`. Pada desktop, posisi mengikuti tepi editor dan tetap tersedia saat editor ditutup. Pada viewport ringkas, kontrol mengambang di kanan bawah dengan safe-area inset, memiliki label dinamis Buka Editor/Tutup Editor, fokus keyboard yang jelas, dan prioritas visual di atas drawer. Aksi, aria-expanded, dan fokus dikendalikan oleh `EditorDrawer` tanpa tombol duplikat. Tombol tersembunyi saat mencetak.
2. **Badge “Preview berwatermark” dihapus** seluruhnya dari toolbar beserta kode status dan CSS yang tidak lagi dipakai. Watermark pada kertas, masking tab tersembunyi, dan mode strict tetap bekerja. Tidak ada perubahan pada isi surat, ekspor PDF, atau gerbang sponsor.
3. **Perbaikan tombol navigasi halaman**: `DocumentViewer._goToPage()` kini menghitung koordinat halaman dari rectangle relatif viewport dan hanya memanggil `#preview-viewport.scrollTo()`. Hal ini menggantikan `scrollIntoView()` yang dapat menggulir ancestor/layout luar dan membuat toolbar preview menghilang. Perhitungan dibatasi pada jangkauan scroll, menjaga `scrollLeft` serta mendukung reduced motion.
4. **PWA**: revisi cache dari v61 menjadi v62 untuk menghindari campuran JS/CSS lama dan baru pada aplikasi terpasang.

## Bukti validasi yang diperlukan

- Unit: `tests/preview-navigation-scroll.test.js` memeriksa next/last/first, nomor halaman dan larangan scroll ancestor.
- Unit: `tests/editor-drawer.test.js` memeriksa kontrol berada di luar navbar dan fokus kembali ke kontrol yang sama.
- Unit: `tests/preview-protection-watermark.test.js` memastikan watermark/strict masking tetap hidup tanpa badge UI.
- Browser CI: `scripts/pp04-browser-uat.js` melatih tombol editor dan empat dummy pages pada viewport desktop/tablet/mobile portrait/landscape. Navbar Preview Surat harus tetap terlihat ketika pindah halaman pertama/terakhir dan hanya scrollTop preview yang berubah.
- Suite regresi: 18 template, PDF print isolation, SponsorExportGate, PWA cache dan tes CI operasional tetap diuji.

## Batasan dan rilis

Tidak ada aktivasi baru, perubahan database, atau perubahan konfigurasi Vercel. Perlindungan Preview Surat tetap best-effort dan tidak dapat memblokir screenshot OS sepenuhnya. PR dibuat untuk tinjauan; **merge dan deployment Vercel dilakukan hanya atas instruksi pengguna**. Status auto-deploy Vercel tetap nonaktif.
