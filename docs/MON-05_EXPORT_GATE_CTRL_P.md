# MON-05 — Integrasi Cetak/PDF dan Ctrl+P/Cmd+P

Tanggal: 11 November 2026; repositori: buatsoalujianmtsnf-lang/generatesurat.

## Status
Implementasi pada PR MON-05; gerbang sponsor tetap **OFF** (tag HTML data-sponsor-gate="off"), kebijakan sponsor dan kampanye tetap nonaktif, dan server SPONSOR_GATE_ENABLED belum diubah. Tidak ada sponsor/video nyata atau Redis produksi, tidak ada deployment Vercel.

## Alur
1. UI memanggil Workflow.preparePrint('button'|'keyboard') atau Workflow.preparePdf().
2. Validasi formulir dan KOP; Surat Izin Tidak Masuk tetap meminta persetujuan orang tua/wali sebelum gerbang sponsor. Saat callback berjalan, template dan formulir diperiksa lagi untuk mencegah perubahan selama iklan.
3. Mode off: tidak memanggil API sponsor dan mempertahankan cetak offline. Mode required: satu sesi video baru untuk setiap tindakan; percobaan bersamaan ditolak, gagal/batal tidak meneruskan ekspor.
4. Cetak: setelah video dan receipt server, POST /api/sponsor-print-authorize mengonsumsi receipt aksi print secara atomik; kemudian Print.printDocument({sponsorAuthorized:true}).
5. PDF: receipt dikirim dalam header X-Sponsor-Receipt. Server /api/export-pdf menolak POST tanpa receipt saat SPONSOR_GATE_ENABLED=true, lalu mengonsumsi receipt sekali pakai **sebelum Chromium**. Perubahan body HTML/PDF tidak diperlukan, sehingga data siswa tidak dikirim ke endpoint sponsor.
6. Ctrl+P/Cmd+P dicegat jika browser mengirim event keydown pada editor ketika data-sponsor-gate="required"; event berulang ditolak. Shortcut dan menu asli browser bukan mekanisme yang dapat dikendalikan secara absolut.

## Peringatan aktivasi
- Jangan aktifkan hanya satu flag. Pada rilis MON-08, HTML data-sponsor-gate harus required **serentak** dengan env SPONSOR_GATE_ENABLED=true, config policy.enabled=true, releasePhase=production, registry.enabled=true, video dan kontrak approved, serta Redis Upstash yang siap.
- Jika server gate aktif sementara HTML lama masih off (misal PWA cache lama), endpoint PDF akan menolak tetapi browser print bisa lolos karena browser tidak memberi keamanan anti-bypass absolut. Perlu rencana paksaan update/rollback dan QA multi-versi.
- Jika gate aktif tanpa koneksi/video/Redis, aplikasi menolak ekspor yang dikendalikannya, bukan melompati iklan secara diam-diam. Penanganan aksesibilitas dan kompensasi kegagalan masih harus disepakati.
- Bukti perhatian manusia tidak dapat disimpulkan dari heartbeat video. Browser dapat membatasi window.print() setelah alur async; pertimbangkan tombol Cetak Sekarang yang memulihkan user gesture pada MON-07 jika perlu.
- CSS print guard menyembunyikan surat pada native print tanpa marker sementara; DevTools, screenshot, menu OS, dan perubahan JS tetap tak dapat diblokir sepenuhnya.
- Receipt dikonsumsi sebelum renderer PDF. Jika renderer gagal setelah konsumsi, receipt tidak bisa dipakai ulang (setiap tindakan baru).
- Auto-deploy Vercel tetap nonaktif; MON-05 tidak menjalankan deploy.

## QA
Tes sponsor-export-gate mencakup mode off, tiap tindakan, PDF, print, pembatalan, kedaluwarsa, replay, Redis tak tersedia, double-click dan Ctrl/Cmd+P. Lanjut UAT browser nyata dan Redis pada MON-07, aktivasi baru pada MON-08.
