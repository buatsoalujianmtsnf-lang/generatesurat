# Perbaikan Tema Gelap dan Tata Letak Editor — November 2026

**Proyek:** Generate Suratku  
**Lingkup:** Enam laporan yang diminta pengguna, termasuk halaman informasi publik terkait.

## Hasil perubahan

1. **Kontrol editor mobile** sekarang berupa *side handle* menempel sisi kanan pada bagian atas/tengah area kerja (`top: clamp(136px, 42dvh, 340px)`), bukan tombol mengambang di kanan bawah. Kontrol tetap berukuran sentuh minimal 48px, tidak berbenturan dengan tombol Sebelumnya/Berikutnya pada `#workflow-actions`, memiliki label dan fokus keyboard, serta mendukung safe-area layar.
2. **Tiga kartu bantuan Beranda** (Mulai dari sini, Hasil dokumen, Bantuan) menggunakan permukaan, judul, paragraf, dan link dengan warna berkontras tinggi jika `data-theme="dark"`. Berlaku juga saat mode otomatis mengikuti preferensi gelap OS.
3. **Branding editor** (logo dan teks Generate Suratku) memiliki kontras khusus pada header mode gelap tanpa mengubah tampilan logo dalam surat/PDF.
4. **Toggle light/dark** kini menggunakan tema yang **sedang terlihat** untuk menentukan kebalikannya; dari `auto` yang terlihat terang langsung menjadi gelap dengan **satu klik**, dan sebaliknya. Pilihan manual disimpan di `localStorage['ui-theme']`. Mode `auto` tetap tersedia melalui `Theme.set('auto')` dan tetap mengikuti `prefers-color-scheme`.
5. **Halaman publik** `/panduan`, `/faq`, `/tentang`, `/privasi`, `/ketentuan` dan `/panduan-cetak-pdf` memakai `js/theme-init.js` *sebelum* CSS, `js/theme.js`, bootstrap `js/public-theme.js`, palet gelap pada `css/public-content.css`, dan tombol pengganti tema aksesibel. Tidak ada inline JS, event handler inline, data pribadi, atau perubahan kebijakan iklan. Skrip AdSense tetap pada tiga halaman yang sebelumnya diizinkan; izin layanan monetisasi tetap tidak diaktifkan.
6. **Navbar editor desktop** menggunakan `justify-content: safe flex-end` untuk meratakan tombol ke kanan sekaligus mempertahankan akses saat ruang tidak cukup. Navbar mobile tidak berubah strukturnya.

## Pengujian otomatis

- `tests/theme-unified-regression.test.js`: satu klik langsung mengganti tampilan, preferensi tersimpan, mode otomatis, CSS kontras, tombol mobile dan enam halaman publik.
- `tests/adsense-content-foundation.test.js`, `tests/adsense-owner-verification.test.js`: allowlist JS *same-origin* baru tanpa memperluas allowed third-party scripts.
- `scripts/pp04-browser-uat.js`: pengukuran kontras sesuai WCAG pada tiga kartu Beranda, warna nama aplikasi, satu-klik tema editor, navigasi enam artikel publik, dan benturan tombol editor dengan workflow mobile.
- PWA cache `v63`, `js/public-theme.js` dan `css/public-content.css` diprecache untuk stabilitas aplikasi terpasang.

## Batas cakupan

Tidak ada modifikasi template surat, struktur data, database, alur cetak/PDF, sponsor, AdSense, atau akses Vercel. Validasi berbasis Chromium headless untuk beberapa viewport bukan substitusi pengujian iOS/Safari/Firefox pada perangkat sungguhan.

**Status rilis:** perubahan disimpan pada branch/PR untuk review. Auto-deploy Vercel harus tetap nonaktif; merge dan deployment manual hanya setelah instruksi eksplisit berikutnya.
