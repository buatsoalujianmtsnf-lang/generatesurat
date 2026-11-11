# MON-09 — Monitoring, Evaluasi dan Iterasi Monetisasi Generate Suratku

Tanggal awal: 11 November 2026 (WIB). Repositori: `buatsoalujianmtsnf-lang/generatesurat`.

## Status eksekusi
**Implementasi observabilitas disiapkan lewat PR, tetapi monitoring produksi TIDAK AKTIF.** MON-08 berada pada `NO_GO`; tidak ada Publisher ID/Google Sites Ready, sponsor berlisensi, UAT fisik lengkap, atau koneksi Upstash sponsor produksi yang tervalidasi. Perilaku cetak/PDF saat ini dipertahankan. Tidak ada deployment atau penayangan iklan.

## Metrik agregat server
| Alur | Nilai yang direkam | Tidak pernah direkam |
|---|---|---|
| Sponsor start, progress, complete, print authorization | Jumlah permintaan, kode HTTP agregat, bucket latensi | Token sesi, receipt, IP, nama sponsor, ID kampanye, data murid, dokumen |
| PDF export | Jumlah permintaan, kode HTTP agregat, bucket latensi | Nama file, isi HTML/CSS, tanda tangan, NIK, nama sekolah |
| Laporan agregat | Total per rute, 4xx/5xx, 403/409/410/429/503, p95 perkiraan | Pengguna individual, lokasi, device identifier, detail surat |

Data ditaruh dalam **Redis hash per hari UTC** di `gs:mon09:v1:YYYY-MM-DD` dan kedaluwarsa otomatis maksimum **14 hari**. Metrik hanya memiliki rute tetap, status terbatas, dan 7 bucket latensi; tidak ada tracking JavaScript, cookie analytics baru, SDK sponsor atau ekspor data mentah. Jangan memakai jumlah `complete` sebagai bukti perhatian manusia.

## Kontrol aktivasi terpisah
- `config/mon09-monitoring.json.enabled=false` secara default.
- `MON09_METRICS_ENABLED=true` pada server bersama dua rahasia Redis yang **belum** terkonfigurasi dan tidak diubah melalui MON-09.
- Metrik hanya direkam jika **kedua** flag benar dan kredensial Redis valid. Kesalahan Redis metrik **tidak** mengubah hasil validasi receipt atau endpoint PDF. Telemetri bersifat best-effort dan dapat kehilangan peristiwa saat timeout/insiden; gunakan log infrastruktur terkontrol sebagai pelengkap.
- `npm run check:mon09` mengonfirmasi baseline nonaktif serta no-go MON-08. Tidak ada cron production job, tidak ada health dashboard publik.

## Ambang awal untuk operator (bukan SLO yang sudah disetujui)
- Minimal **30 permintaan/rute** sebelum evaluasi alarm. PDF 5xx >5%, sponsor-start 503 >5%, sponsor-start 429 >10%, p95 PDF *bucket upper bound* >8 detik.
- Status `NO_DATA` berarti belum ada metrik, **bukan aplikasi sehat**. `INSUFFICIENT_DATA` berarti sampel di bawah minimum. `ALERT` membutuhkan investigasi manusia.
- Metrik bucket p95 bukan latensi presisi; jumlah penyelesaian sponsor tidak membuktikan pengguna menonton penuh.
- Periksa juga kepatuhan privasi, kualitas konten publik AdSense, keluhan, aksesibilitas, dan biaya Redis/Vercel secara manual.

## Siklus iterasi
1. **Harian setelah rilis disahkan:** operator membaca laporan agregat, error 403/409/410/429/503, PDF 5xx, Redis, dan temuan support. Saat rilis masih NO_GO, fokus pada CI, health readiness, dan blocker UAT.
2. **Mingguan:** tinjau tren 7 hari, biaya dan kapasitas, performa pemuatan video 15 detik di ponsel, pembatalan, aksesibilitas, serta kebijakan Google yang berubah. Tentukan maksimal 1–3 masalah prioritas, owner, tanggal, bukti dan pengujian.
3. **Per iterasi:** buat issue/PR, reproduksi bug, tambah tes regresi, jalankan CI, uji staging, review privasi dan keamanan. Merge hanya setelah CI lulus. Tidak ada deployment otomatis.
4. **Insiden:** jika penerimaan PDF gagal, playback tidak berjalan, banyak 503, ada data anak di log, atau keluhan kebijakan iklan, gunakan SOP MON-07 untuk pause/rollback **manual**, dengan owner dan bukti tindakan. Jangan auto-bypass sponsor dan jangan otomatis mengubah flag server saat alert.
5. **Bulanan:** evaluasi kebutuhan laporan/retensi, verifikasi akses data, penilaian keabsahan iklan, kesiapan AdSense, dan pelatihan tim. Jika alert sering palsu, ubah ambang lewat PR yang diuji dan disetujui.

## Penggunaan laporan
- `npm run check:mon09`: memverifikasi konfigurasi aman dan menolak go-live.
- `node scripts/mon09-report.js`: hanya mencetak `MONITORING_DISABLED` pada konfigurasi saat ini (tidak menebak kondisi produksi).
- `node scripts/mon09-report.js --live --days=7` setelah *secara resmi* mengaktifkan pengumpulan dan mengatur kredensial Redis: membaca HGETALL agregat 7 hari, menghitung KPI per rute dan ambang, mencetak JSON tanpa PII. Jalankan dari lingkungan operator yang aman, jangan mengunggah raw log/rahasia ke repositori.
- CLI tidak pernah mengubah flag AdSense/sponsor, mengirim surel, membuat tiket atau deploy secara otomatis.

## Daftar validasi lanjutan
- [ ] Google AdSense Sites Ready, ID resmi, Policy center, ads.txt dan CMP jika relevan
- [ ] Kontrak/video sponsor, hak tayang, moderasi dan fallback aksesibilitas disahkan
- [ ] Redis sponsor Vercel langsung dan replay/failover teruji
- [ ] 15 UAT fisik MON-07 dan pilot 50 tindakan paralel telah disetujui
- [ ] Perangkat PWA lama, Ctrl/Cmd+P dan PDF direct POST tervalidasi
- [ ] Pemilik monitoring, biaya, akses laporan, target SLO, incident escalation, retention disahkan
- [ ] Operator menyelesaikan GO/NO_GO MON-08 dan memperoleh izin deploy manual
- [ ] Monitoring diaktifkan hanya setelah perubahan disetujui, bukan akibat merge PR

## Batasan
Telemetry agregat tidak mendeteksi kegagalan browser yang tidak mengirim request, kemacetan video sebelum start, iklan AdSense dari pihak Google, pengembalian dari browser Print, atau keberhasilan cetak fisik. Pengamatan ini membutuhkan UAT perangkat, laporan pengguna/komplain, dan platform logs/Google AdSense sesudah persetujuan. Tidak ada otomatisasi background atau alert proaktif yang aktif hanya karena file ini dibuat.

Laporan rilis `MON-09` tidak dapat dinyatakan lulus produksi hingga penanggung jawab menyetujui dan data nyata masuk.

## Pembuktian atomisitas Redis untuk MON-09
Pipeline Redis 7.4 terisolasi dari MON-07 diperluas untuk menguji **25 penulisan metrik konkuren** serta TTL 14 hari menggunakan skrip Lua MON-09. Ini bukti integrasi pada Redis nyata dalam CI, **bukan** observasi atau pengujian beban Upstash produksi. Job `mon09-baseline` menerbitkan artefak `MONITORING_NOT_ACTIVATED` / `NOT_QUERIED` secara jujur tanpa koneksi layanan pihak ketiga.
