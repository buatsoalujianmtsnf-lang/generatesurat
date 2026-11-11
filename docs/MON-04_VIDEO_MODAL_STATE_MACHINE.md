# MON-04 — UI Modal Video Sponsor dan State Machine

Tanggal: 11 November 2026 WIB. Repositori: `buatsoalujianmtsnf-lang/generatesurat`.

## Status
UI front-end tersedia sebagai komponen yang dapat dipanggil, **belum dihubungkan** ke tombol Cetak, PDF, atau pintasan keyboard (dikerjakan MON-05). Tidak ada konten sponsor nyata, Redis live, atau aktivasi. AdSense tetap khusus untuk halaman publik dan belum aktif.

## API UI
`SponsorVideoModal.request({action:'print'|'pdf',source:'button'|'keyboard'})` → Promise yang menyelesaikan `null` jika dibatalkan, modal sedang sibuk, atau browser tidak mendukung native dialog; bila server memverifikasi video → `{action,receipt,expiresAt}`. Receipt **belum** diotorisasi untuk ekspor sampai dikonsumsi oleh MON-05.

## Alur
`idle → starting → ready → playing ↔ paused → verifying → authorized`; alternatif `error → retry → starting` dan semua tahap aktif dapat `cancel`. Backend MON-03 mengeluarkan sessionToken dan receipt. Browser hanya mengirim posisi/playing/visible sekitar tiap detik; penghitung waktu klien tidak menentukan izin ekspor. Event `ended` memerlukan heartbeat final dan verifikasi server. Token di memori saja, tidak dalam URL, storage, atau analytics.

## Antarmuka dan keselamatan
Native `<dialog>` dengan focus trap browser, ESC/click backdrop dan Cancel menutup **tanpa izin**. Tombol Play/Pause, mute, retry, status ARIA, progress info, caption VTT bila ada, layar mobile/landscape, dark/light dan reduced motion. Autoplay tidak dipaksakan. Kecepatan dan seek dicegah pada alur normal; tab tersembunyi mem-pause. Pemutar tidak pernah dimasukkan ke PDF atau CSS cetak. Semua teks merek ditempatkan melalui `textContent`.

Video dibatasi pada `/assets/sponsors/`, tanpa tracking pixel, skrip eksternal, atau dokumen siswa. Perubahan API menambahkan `sponsorName` dan `captionsPath` yang bersumber dari kampanye approved. Konten video sendiri dan kontrak berlisensi tetap belum tersedia.

## PWA/CSP
`sw.js` cache v52 untuk CSS dan JS baru, tanpa men-cache video sponsor maupun POST API. CSP yang membatasi script dan koneksi ke `self` tetap tidak diubah.

## Acceptance
- `npm run check`, coverage, audit dependency di GitHub Actions.
- UAT E2E device, audio, bahasa, caption, 200% zoom, offline, throttling, keyboard, multiple tabs, blocking autoplay di MON-07.
- Integrasi MON-05 memasang gate setelah validasi surat dan sebelum export, dengan server-only konsumsi receipt PDF. Cetak dan Ctrl/Cmd+P tidak dapat dikunci absolut.
- Tidak boleh aktif sebelum sponsor resmi, Redis, kebutuhan hukum/privasi, dan gate penerimaan seluruh tahap lulus.
