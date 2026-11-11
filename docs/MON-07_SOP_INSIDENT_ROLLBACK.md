# MON-07 — SOP Insiden, Aktivasi Terkoordinasi dan Rollback

**DOKUMEN RENCANA — belum ada persetujuan penerimaan, deployment, aktivasi atau rollback nyata.**
Revisi terakhir 11 November 2026.

## Kewajiban sebelum pilot
- Penanggung jawab produk dan privasi menyetujui kontrak sponsor, durasi 15 detik, paparan terhadap anak, kebijakan aksesibilitas dan model pembayaran. Hak video, merek, musik, talent, caption dan hash file wajib lengkap.
- Redis Upstash produk/staging dikonfigurasi dengan secret server yang tidak diekspos di JavaScript, dan diuji pada endpoint aktual Vercel. Test CI Redis lokal bukan uji produksi.
- Pemetaan dua flag client/server serta `config/sponsor-policy.json`, `config/sponsor-campaigns.json` dan cache PWA ditetapkan untuk satu rilis. Anti-version-skew harus diperiksa.
- Review privasi, GDPR/CMP AdSense pada konten publik dan klaim sekolah/anak. Sponsor first-party tidak boleh memuat SDK/pixel atau memperoleh identitas/dokumen pengguna.
- Pemilik insiden, jalur komunikasi dan nomor kontak (arsip privat) ditentukan. Hanya penyedia bukti persetujuan dan admin terotorisasi boleh menjalankan perubahan.

## Pemantauan (agregat, tanpa data surat/PII)
Pantau jumlah start, complete, authorizePrint, PDF receipt consume, 403/409/410/429/503, latensi p50/p95/p99, load failure, waktu buffer, rasio refund/komplain, penggunaan Redis/memory dan error render PDF. Jangan log isi surat, nama anak, token, IP mentah, query, payload HTML, caption yang mungkin mengidentifikasi pengguna.
Retensi dan pihak pemroses harus disahkan sebelum go-live. Definisi 'video complete' tidak menyatakan 100% perhatian manusia.

## Tabel insiden
| Kejadian | Perilaku aman | Respon |
|---|---|---|
| Video/media 404, stall atau CDN error | Stop/no receipt; pesan jelas | Pause kampanye, verifikasi asset dan hash, dokumentasi klaim sponsor |
| Redis error/timeout/unreachable | Server 503, no PDF bypass | Status incident, identifikasi operasi Lua/limiter, putuskan rollback |
| Rate-limit 429 / replay 409 | Tolak permintaan tanpa data sensitif | Audit agregat dan pola abuse; jangan menaikkan batas tanpa pengujian |
| Browser print diblokir | Receipt mungkin sudah konsumsi | Berikan pesan dan alur tindakan baru; uji kebutuhan gesture baru |
| Dokumen gagal render setelah receipt | Receipt satu kali hilang | Tandai insiden dan tata cara kompensasi sponsor/aksesibilitas |
| PWA HTML lama + server baru | Risiko beda gerbang | Hentikan rollout, paksa refresh terkontrol, ujicoba tab lama |
| Konten sponsor melanggar | Pause segera | Cabut rotasi, beritahu sponsor, simpan bukti privat |

## Rollback yang harus diuji pada staging
1. Putuskan penghentian kampanye dan dokumentasikan dasar, waktu, rilis, serta pemilik.
2. Pada **satu rilis terkoordinasi**, nonaktifkan `SPONSOR_GATE_ENABLED` (server), `policy.enabled`, `registry.enabled`, dan `data-sponsor-gate` pada HTML. Urutan dan masa overlap versi lama harus diuji, bukan diasumsikan aman.
3. Perbarui PWA/cache, verifikasi semua tab/device termasuk offline; siapkan pesan status kepada pengguna. Jangan menggunakan `window.print()` sebagai klaim pengamanan dokumen tanpa DRM.
4. Uji PDF langsung dan UI ketika sponsor dinonaktifkan sesuai keputusan resmi. Pastikan tidak ada iklan yang bocor ke pratinjau/hasil.
5. Dokumentasikan durasi rollback, penyelesaian komplain, dampak finansial, dan persetujuan pemilik sebelum membuka kembali.
6. Auto-deploy Vercel harus tetap nonaktif; deployment manual hanya bila pengguna memberi instruksi tersendiri.

**KEPUTUSAN SEKARANG: BLOCKED.** Tidak ada bukti latihan rollback nyata. Jangan menandai tuntas dengan simulasi atau CI saja.
