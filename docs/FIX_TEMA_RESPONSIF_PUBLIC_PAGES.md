# Pembaruan UI Responsif dan Konsistensi Tema Generate Suratku

**Tanggal:** 11 November 2026  
**Cakupan:** perbaikan 6 permintaan pengguna terhadap tombol editor mobile, kontras Beranda, branding Editor, tombol tema, halaman informasi, dan navbar desktop.

## Perubahan

1. **Kontrol Buka/Tutup Editor di mobile** menggunakan tab sisi kanan yang ramping, tidak berada di bawah dekat tombol navigasi workflow. Mempertahankan satu tombol aksesibel, label dinamis, area sentuh, fokus keyboard, state drawer, dan fitur kembalikan fokus. Mode landscape menggunakan posisi adaptif yang lebih tinggi; ketika drawer terbuka kontrol tetap dapat ditemukan.
2. **Kontras gelap tiga kartu panduan Beranda** (Mulai dari sini, Hasil dokumen, Bantuan) kini berasal dari token desain bersama: `--color-surface`, `--color-text`, `--color-text-secondary`, `--color-primary`; tidak lagi memakai latar putih pada teks terang.
3. **Branding pada navbar Editor** diberi prioritas kontras tinggi saat `data-theme="dark"` termasuk dark otomatis dari sistem; teks Generate Suratku kini putih terang di permukaan gelap.
4. **Tombol tema berubah dalam satu klik**: klik selalu mengganti *warna yang sedang terlihat* (gelap ⇄ terang), bukan berputar melalui mode `auto` yang kadang mempunyai warna sama. Nilai yang dipilih dipersistenkan sebagai `ui-theme=light|dark`; mode `auto` tetap didukung sebagai keadaan awal dari preferensi sistem. `Theme.init` idempoten untuk menghindari listener ganda. Ikon terang/gelap tidak lagi tertahan oleh inline display:none.
5. **Halaman informasi** Panduan, FAQ, Tentang, Privasi, dan Ketentuan serta Panduan Cetak/PDF berbagi `js/theme-init.js` sebelum CSS, `js/theme.js` dan `js/public-theme.js`, dengan tombol tema aksesibel pada header setiap halaman. Stylesheet `public-content.css` menyediakan warna gelap yang kontras untuk latar, artikel, navigasi, footer, tabel, tautan, kartu, dan teks.
6. **Navbar Editor desktop** menata deretan tindakan ke kanan menggunakan `justify-content: safe flex-end` dan `margin-left:auto` untuk lebar desktop, tanpa menghilangkan overflow aman di ukuran antara.

## Offline dan validasi

- PWA shell v62 → **v63**; semua 6 halaman informasi serta CSS/JS temanya diprecache. Tidak ada migrasi database ataupun perubahan logika PDF/Cetak/sponsor.
- Uji unit baru `tests/theme-public-consistency.test.js`: klik pertama dari auto light/dark, persistensi, init idempoten, 6 halaman informasi, token kontras, posisi tombol, navbar kanan dan cache.
- Chromium PP-04 UAT: pengujian 4 viewport, perubahan tema langsung pada editor, branding, 3 kartu panduan, 6 halaman informasi pada desktop/mobile, keselarasan posisi tombol editor terhadap workflow dan header actions desktop.
- UAT fisik iPhone/iPad, Safari/Firefox/Android yang nyata, PDF server produksi, dan cetak fisik masih perlu pemeriksaan manual.

## Rollback dan rilis

Perubahan berada pada branch dan PR khusus; belum di-merge maupun di-deploy tanpa instruksi lanjutan. Auto-deploy Vercel tetap nonaktif. Untuk mengembalikan tema awal, pengguna dapat memilih tema sesuai preferensi dan membuka ulang halaman; kode juga tetap kompatibel dengan `ui-theme=auto` dari instalasi sebelumnya.
