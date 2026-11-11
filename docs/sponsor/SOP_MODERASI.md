# SOP MODERASI DAN PERSETUJUAN SPONSOR — MON-02

## Alur status
`draft` → `in_review` → `approved` → `paused` / `archived`.
Status `approved` **bukan penayangan otomatis**: diperlukan `policy.enabled:true`, `registry.enabled:true`, `releasePhase:production`, rentang tanggal aktif serta validasi server (MON-03–MON-05). Semua **nonaktif** sekarang.

## Tanggung jawab
- **Pengelola komersial:** menerima permohonan sponsor, rencana periode, tarif; menyimpan kontrak final di arsip privat, bukan di git.
- **Moderator materi:** menonton utuh, memeriksa identitas barang/jasa dan klaim, kecocokan untuk pelajar, lisensi musik/gambar/talent, hak penayangan, caption dan tautan.
- **Peninjau privasi/kebijakan:** memastikan tidak ada pelacak, permintaan data pribadi, konten anak yang dilarang, maupun iklan Google dalam player. Periksa kebijakan AdSense pada level situs meskipun kode iklan diisolasi.
- **Operator rilis:** memeriksa file final dan SHA-256, bukti kontrak, hasil validator, CI, konfigurasi fail-closed, dan rencana rollback sebelum mengubah status. Minimal dua orang meninjau keputusan yang berbeda.

## Daftar periksa review per kampanye
- [ ] Sponsor teridentifikasi secara sah; perjanjian dan ruang lingkup dipahami
- [ ] Semua hak atas merek, video, audio, talent, testimoni dapat dibuktikan
- [ ] Video asli 15 detik dan hash tervalidasi `ffprobe`, tanpa penggantian setelah persetujuan
- [ ] Tidak ada kategori terlarang/claim menyesatkan/CTA palsu
- [ ] Persetujuan penayangan wajib per tindakan dinyatakan jelas pada kontrak
- [ ] Tidak ada *forced click*; pengguna tidak wajib mengunjungi website sponsor
- [ ] Materi tidak memuat informasi siswa atau data sensitif
- [ ] Subtitle tersedia jika ada ucapan, kontrol aksesibilitas diuji
- [ ] URL sponsor HTTPS aman dan tidak mengandung query user/tracking
- [ ] Tidak ada request/pixel/SDK pihak ketiga yang diberi akses ke editor
- [ ] Draf Kebijakan Privasi dan Ketentuan Penggunaan diperbarui sebelum aktivasi
- [ ] Jadwal, tingkat penayangan, pembatalan, dan laporan agregat disepakati
- [ ] Rencana penarikan/kill switch dan penanganan iklan gagal disetujui

## Penanganan keluhan dan pencabutan
Jika muncul klaim menyesatkan, komplain anak/orang tua, atau takedown hak cipta: **pause kampanye** dahulu, catat alasan secara privat, cabut materi dari rotasi, verifikasi fakta, lalu putuskan pengembalian atau penghentian sesuai kontrak. Hindari menampilkan materi rusak terus-menerus hanya untuk memenuhi jatah sponsor.

## Batas privasi dan audit
Jangan memasukkan nama siswa, identitas wali, NIK, nomor telepon, isi surat, hasil ekspor, atau token sesi ke log sponsor. Log cukup metrik teknis agregat: `campaignId`, `eventType`, waktu, aksi, dan status. Retensi, pengawasan, serta kontrol akses harus ditetapkan saat backend dibangun. Dokumen kontrak dengan tanda tangan bukan berkas publik dalam repo.

## Sumber kebijakan
- https://support.google.com/adsense/answer/48182?hl=id
- https://support.google.com/adsense/answer/1346295?hl=en
- https://peraturan.bpk.go.id/Details/229798/uu-no-27-
