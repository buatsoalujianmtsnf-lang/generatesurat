# MON-03 — Backend State dan Receipt

**11 November 2026** · Repo: `buatsoalujianmtsnf-lang/generatesurat` · **Implementasi di branch, belum aktif dan belum dideploy.**

## Keputusan arsitektur
- Sesi sponsor dan receipt disimpan **terpusat** pada Upstash Redis via REST/EVAL (bukan memori function, bukan localStorage), key diturunkan dari SHA-256 token acak 256-bit.
- Satu tindakan baru Cetak/PDF/shortcut yang didukung → sesi 5 menit → heartbeat berjalan → complete → **receipt aksi spesifik** yang berlaku 120 detik → dikonsumsi sekali.
- Semua transisi heartbeat, complete, consume dan rate limit menggunakan operasi Redis EVAL sehingga mutasi bersifat atomik antar-instance Vercel.
- Progres hanya diberi kredit untuk sampel posisi pemutaran berurutan dengan timestamp server, kondisi playing+visible, selisih waktu <=2,5 detik, laju media wajar. Complete memerlukan waktu server sekurang-kurangnya 15 detik, progres terakumulasi setidaknya 14 detik, posisi akhir >=14,8 detik, heartbeat segar dan flag ended.
- **Bukan bukti perhatian manusia**: klien dapat dimodifikasi. Perlu UAT browser nyata dan anti-abuse lebih lanjut sebelum komersialisasi.

## Kontrak API (semua POST JSON, same-origin, no-store)
| Path | Body | Output | Pembatas |
|---|---|---|---|
| `/api/sponsor-start` | `{action:"print"\|"pdf",source:"button"\|"keyboard"}` | `{sessionToken,action,campaignId,mediaPath,mediaType,durationSeconds:15,expiresAt}` | hanya kampanye approved dan aktif; source keyboard hanya untuk print |
| `/api/sponsor-progress` | `{sessionToken,positionMs,playing,visible}` | `{accepted,creditedMs}` | tetap bertahap; tak menerima posisi lompat |
| `/api/sponsor-complete` | `{sessionToken,ended:true}` | `{receipt,expiresAt}` | min waktu server+progress |
| `/api/sponsor-print-authorize` | `{receipt}` | `{authorized:true}` | consume atomik, action print saja |

Untuk PDF, **tidak ada public authorize endpoint**. MON-05 harus memanggil `createSponsorService(...).consumePdfReceipt({receipt})` dari `api/export-pdf.js` setelah validasi dokumen, **sebelum** rendering. Hal ini belum diimplementasikan pada tahap MON-03, sehingga endpoint PDF lama masih berperilaku seperti sebelumnya sampai gate diaktifkan serentak pada MON-05. Untuk cetak browser, bahkan receipt valid tidak dapat mengunci menu Print/DevTools secara absolut.

## Aktivasi dan variable server rahasia
Prasyarat keseluruhan: `config/sponsor-policy.json.enabled=true`, `releasePhase=production`, `config/sponsor-campaigns.json.enabled=true`, kampanye approved pada periode yang sah, **serta** variabel lingkungan:
- `SPONSOR_GATE_ENABLED=true`
- `UPSTASH_REDIS_REST_URL` (HTTPS)
- `UPSTASH_REDIS_REST_TOKEN`
- `SPONSOR_IP_HASH_SECRET` (>=32 karakter acak; HMAC-IP untuk rate-limit, rahasiakan)

**Saat ini semua flag sponsor masih nonaktif; tidak membuat/menyimpan token atau nilai variabel apa pun.** Endpoint merespons `503 SPONSOR_UNAVAILABLE` tanpa mengakses Redis. Jangan mengaktifkan gate sebelum MON-04/05/06/07 lulus dan sponsor nyata tersedia.

## Keamanan dan privasi
- Origin wajib sama dengan host HTTPS aktual yang dilayani, Site=Cross-site ditolak; tidak mengandalkan CORS atau header Origin sebagai autentikasi terhadap klien nonbrowser.
- Rate limit per-IP HMAC (IP mentah tidak disimpan di Redis): start 12/menit, progress 150/menit, complete 24/menit, print 24/menit. Materi dan isi surat tidak ada di payload sponsor.
- URL video harus first-party; tidak ada injeksi skrip AdSense, cookie marketing, atau pixel sponsor.
- Token rahasia hanya dalam POST body dan JSON response, dengan Cache-Control no-store dan Referrer-Policy no-referrer. **Tidak** diletakkan di query string, log, DOM data attribute, atau analytics.
- Jika Redis gagal, expired, token replay, salah action, tidak ada media atau belum approved → server menolak. Sesi video buffering/tab tidak terlihat tidak dikredit.
- 15 detik durasi video diverifikasi pada MON-02 dengan ffprobe sebelum approval; progres ditandai oleh browser tetap bisa dipalsukan.
- Tidak ada *user tracking* sponsor, data siswa, NIK, tanda tangan, isi atau jenis surat dalam kontrak API.

## Pengujian dan bukti
- `tests/sponsor-receipt.test.js` menguji transisi dan kegagalan dengan adapter Redis test; periksa log GitHub Actions untuk tes seluruh aplikasi.
- Tidak ada Redis live pada MON-03, jadi concurrency race pada **Redis asli**, performa jaringan, retry/timeout dan failover tetap gate UAT MON-07.
- Tidak mengubah print/PDF lama, tidak menambahkan video UI, tidak mengaktifkan AdSense.
- PWA yang ada tidak cache POST `/api/*`; verifikasi kembali di MON-06.

## Jalur lanjutan
MON-04 UI/player; MON-05 refactor cetak/PDF, konsumsi receipt PDF dan penanganan Ctrl/Cmd+P; MON-06 CSP/PWA/privasi; MON-07 UAT. MON-08 hanya aktif setelah kontrak nyata, Redis, approval dan seluruh tes lulus; auto-deploy tetap off.

## Penguatan tambahan
- Kunci sesi dan receipt memakai hash-tag Redis Cluster `{atomic}` agar `EVAL` dua key tetap berada di satu slot.
- Endpoint menolak field JSON yang tidak termasuk kontrak masing-masing operasi, untuk mengurangi risiko data dokumen terkirim tanpa sengaja.
- Uji tambahan receipt kedaluwarsa 120 detik, termasuk replay yang ditolak.
