# MON-08 — Checklist Penerimaan dan Aktivasi Terkendali

**Status rilis:** NO_GO. Checklist ini adalah rencana, bukan catatan pelaksanaan go-live.

## I. Google AdSense — lane terpisah
- [ ] Domain layak/diterima di Google AdSense Sites; jika subdomain Vercel tidak layak, gunakan domain kustom.
- [ ] Akun publisher aktif, Publisher ID resmi dicatat aman, domain ownership diverifikasi.
- [ ] Permintaan review resmi dikirim dari AdSense Sites setelah verifikasi; status **Ready** di akun diverifikasi ulang.
- [ ] Policy center tanpa temuan relevan; halaman konten publik orisinal dan memenuhi kebijakan.
- [ ] Baris `ads.txt` memakai ID Google nyata dan statusnya sesuai akun.
- [ ] Persetujuan/CMP tersertifikasi untuk wilayah yang diwajibkan; jika tidak relevan, alasannya didokumentasikan.
- [ ] Unit manual hanya dalam /panduan, /panduan-cetak-pdf, /faq; Auto Ads OFF.
- [ ] CSP publik khusus disetujui dan kode Google hanya disuntik pada rute mandiri, tidak pada HTML halaman editor.
- [ ] QA mobile, keyboard, data pribadi, konten, performa dan kebijakan iklan; penandatanganan operator.
- [ ] Deploy manual dengan izin baru dan smoke monitoring; belum dilakukan.

## II. Sponsor mandiri — lane terpisah
- [ ] Sponsor resmi, kontrak tertandatangani, izin video/talent/audio/logo serta moderasi.
- [ ] Format/durasi tepat 15 detik dan caption, aksesibilitas, dan kebijakan tanpa klik wajib diverifikasi.
- [ ] Redis Upstash production/staging dengan rahasia server dan pengamanan network telah diuji langsung.
- [ ] PDF direct POST, receipt replay/expired/wrong action/race diuji pada staging Vercel.
- [ ] 15 UAT perangkat nyata MON-07 dilaksanakan dengan bukti; minimal 50 tindakan paralel dan p95/p99 tercatat.
- [ ] Tab lama, PWA offline/online, CSP, shortcut Ctrl/Cmd+P dan menu cetak browser tercakup.
- [ ] Opsi bantuan darurat/aksesibilitas dan kompensasi jika video/server gagal disetujui.
- [ ] Kill switch UI/server/config dan latihan rollback dijalankan, tidak hanya dijabarkan.
- [ ] Pemilik insiden, kebijakan retensi/log, serta keputusan go/no-go tertandatangani.
- [ ] Deploy **manual** ke lingkungan teruji dan observasi; belum dilakukan.

## III. Stop conditions sebelum/selama peluncuran
1. AdSense `Getting ready`, `Requires review`, `Needs attention`, atau tidak ada bukti `Ready`.
2. Sponsor video tanpa izin, tidak memenuhi 15 detik, iklan melanggar kebijakan atau memerlukan klik.
3. Redis 503/failover tidak teruji, replay receipt lolos, PDF bisa tanpa receipt ketika flag aktif, atau data siswa di telemetry.
4. PWA lama tidak sinkron dengan server atau rollback belum diuji.
5. Kegagalan aksesibilitas, browser/iOS Cetak tidak berfungsi sesudah penayangan, keluhan kritis.
6. Tidak ada surat persetujuan final dari penanggung jawab rilis.

Rollback wajib menonaktifkan jalur AdSense publik dan gerbang sponsor secara terpisah sesuai masalahnya, memperhatikan sinkronisasi client/PWA, tanpa otomatis memperbolehkan bypass video pada sebagian klien. Rilis berikutnya memerlukan PR baru dan izin deployment manual; auto-deploy tidak boleh diaktifkan.

Sumber: [AdSense status](https://support.google.com/adsense/answer/12170222?hl=en), [CMP](https://support.google.com/adsense/answer/13554116?hl=en), [kebijakan inventaris](https://support.google.com/publisherpolicies/answer/11112688?hl=en).
