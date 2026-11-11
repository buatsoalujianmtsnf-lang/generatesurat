# MON-06 — Keamanan, Privasi, CSP, PWA dan Penanganan Kegagalan
Tanggal: 11 November 2026 (Asia/Jakarta). Repositori: buatsoalujianmtsnf-lang/generatesurat.

## Ruang lingkup yang dikerjakan
- **CSP global tetap ketat:** media-src 'self', frame-src 'none', script-src 'self', connect-src 'self'. Editor tidak mendapat domain Google Ads, iframe atau SDK sponsor. CSS daisyUI saat ini masih memakai cdn.jsdelivr.net yang sudah diizinkan sebelumnya; migrasi ke bundling lokal dapat memperkecil permukaan jaringan di tahap selanjutnya.
- **Header jaringan:** path /api/* serta /assets/sponsors/* memakai Cache-Control private,no-store; origin sponsor dibatasi melalui CORP same-origin; Referrer-Policy no-referrer. No-store tidak menjamin browser/proxy jahat menghapus cache; gunakan aset minim data dan referensi lisensi jelas.
- **PWA:** sw.js v54 mengabaikan GET /api/* serta seluruh /assets/sponsors/* (video, poster, takarir). Cache lama dihapus saat versi worker baru aktif; worker tidak meng-cache token atau respons sponsor. App shell editor tetap mendukung offline saat gerbang belum aktif.
- **Ctrl+P/Cmd+P:** meniadakan duplikasi dari Platform bubble handler saat sponsor capture handler telah memakai event (defaultPrevented dan stopPropagation). Shortcut tetap best-effort, tidak mengendalikan browser menu atau Print dialog OS.
- **Pemutar video:** time-out video 12 detik bila metadata tidak tersedia atau buffering terlalu lama, pesan status/gagal yang dapat dibaca dan tombol Coba lagi dengan sesi baru. Gagal koneksi tidak otomatis mengizinkan ekspor.
- **Receipt print:** marker CSS dicabut pada afterprint atau selambatnya 8 detik untuk menghindari status authorized tersangkut. Jendela pendek tersebut tidak membuktikan pencetakan satu kali, karena browser tidak menyediakan kontrak semacam itu.
- **API:** mengembalikan Retry-After saat 429 (60 detik) / 503 (15 detik), status no-store, dan tidak menulis data surat, IP mentah, receipt atau token ke log. Backend PDF tetap mengonsumsi receipt sekali pakai secara atomik sebelum rendering saat SPONSOR_GATE_ENABLED=true.
- **Halaman publik:** memperjelas pemrosesan dokumen, TTL state sponsor (sesi maks 5 menit, receipt 120 detik, rate limit HMAC-IP 60 detik), penggunaan aset pihak ketiga, batas hosting/log dan CMP AdSense yang diperlukan di wilayah yang diatur.

## Poin yang belum dapat dianggap aman / go-live
1. **Belum ada sponsor sah/kontrak/video/Redis live**. Setiap flag tetap OFF (index data-sponsor-gate=off; config sponsor-policy/campaign disabled; env server tidak diubah). MON-06 tidak menguji sponsor end-to-end.
2. **Sinkronisasi PWA lama vs server gate aktif:** pengguna dengan HTML cached lama bisa memiliki flag off ketika server aktif; PDF tetap ditolak, sedangkan browser print tidak dapat diproteksi absolut. Harus ada protokol rilis MON-07/08 (versi minimum, deteksi reload, pengumuman, rollback konsisten dan fallback aksesibilitas). Jangan aktifkan sebelum UAT kasus ini.
3. **Browser print**: native menu, screenshot, DevTools, ekstensi, manipulasi JS, print via browser/OS dapat melewati UI. Penanganan Ctrl/Cmd+P dan CSS print bukan DRM atau proteksi hak akses yang tidak dapat dibobol.
4. **Jeda buffering:** heartbeat yang melapor waktu berjalan tidak membuktikan perhatian manusia; interval sampel dan elapsed server hanya mempersulit percepatan. Pengujian Redis nyata dan tab background belum dilakukan.
5. **Pencetakan setelah async:** iOS/Safari/Chrome versi tertentu dapat menolak window.print() tanpa gesture pengguna yang baru. MON-07 harus menguji dan dapat memerlukan tombol eksplisit "Cetak sekarang" setelah receipt.
6. **Gagal video/aksesibilitas:** default fail-closed, pengguna dapat membatalkan dan mencoba lagi. Alternatif akses jika layanan rusak atau ada kebutuhan aksesibilitas wajib diputuskan secara operasional sebelum monetisasi diaktifkan.
7. **Google AdSense:** masih belum aktif, dan tidak boleh ditempel pada editor/pratinjau/hasil dokumen. Domain AdSense tidak ditambahkan ke CSP global. Untuk halaman publik perlu konfigurasi route-scoped, kepatuhan kebijakan, dan CMP terverifikasi jika diwajibkan. Materi sponsor mandiri pada situs yang sama tetap perlu evaluasi kepatuhan tingkat situs.
8. **Data anak:** minimisasi, kewenangan penerbit, jalur keluhan/permintaan data, kebijakan retensi provider, serta audit lisensi video tetap perlu review oleh penanggung jawab privasi.
9. **No automatic deployment:** vercel.json git.deploymentEnabled=false tetap dipertahankan, tidak menjalankan Vercel CLI/API deploy.

## Pengujian yang diperlukan selanjutnya
- GitHub Actions npm run check, npm run test:coverage, npm audit --audit-level=moderate.
- Browser desktop/mobile: modal keyboard/screen reader, buffering, hilang jaringan, kesalahan Redis, bitrate, audio/takarir, orientation/resize, interrupted print, popup blocking.
- Test server live: replay/concurrent receipt, flood, tenant isolation if any, failover Redis, 429/503, logging PII and Content-Security-Policy.
- PWA: upgrade v53→v54 saat offline/online, cache posters lama, tab tetap terbuka saat deploy, versi server vs client berbeda, rollback.
- Check HTTP: /assets/sponsors/* no-store/CORP/referrer; /api/* no-store; editor no ad scripts; static public pages bebas tracker; print/PDF tanpa media iklan.

## Sumber kebijakan untuk peninjauan sebelum aktivasi
- https://support.google.com/adsense/answer/48182
- https://support.google.com/adsense/answer/9121589
- https://support.google.com/adsense/answer/13554116
- https://support.google.com/adsense/answer/1348695

**Keputusan:** MON-06 bisa lulus pada level kode/CI; belum merupakan persetujuan komersialisasi. Lanjut MON-07 dengan lingkungan pengujian dan sponsor contoh berlisensi resmi, bukan data anak asli.
