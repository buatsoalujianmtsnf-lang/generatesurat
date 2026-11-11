# SPESIFIKASI VIDEO SPONSOR 15 DETIK — MON-02

**Tujuan:** Materi sponsor mandiri (bukan Google AdSense) untuk gerbang ekspor pada tiap tindakan Cetak, PDF, dan pintasan yang dapat dicegat browser.

## Spesifikasi wajib
| Butir | Spesifikasi |
|---|---|
| Panjang tayangan | **15,0 detik**; toleransi pengukuran ffprobe ±0,12 detik untuk ketidaktepatan container/frame |
| Codec/distribusi | MP4 H.264 disarankan; WebM VP8/VP9 sebagai format alternatif |
| Dimensi | 16:9 direkomendasikan, 1280×720; maksimum 1920×1080; minimum 320×180 |
| Ukuran | Maksimum **10 MiB** per video |
| Audio | Tidak boleh memulai audio mengejutkan; tombol putar dan opsi suara jelas |
| Caption | VTT bahasa Indonesia untuk narasi/ucapan; caption atau transkrip untuk aksesibilitas |
| Hosting | **First-party**, dari `assets/sponsors/<kampanye>/<asset>.mp4` atau `.webm` |
| Skrip pihak ketiga | **Dilarang**; tidak ada JS/pixel/tracker di video atau player |
| Metadata | SHA-256, referensi hak, periode, ID kampanye, hasil moderasi dan persetujuan operator |
| Tautan tujuan | Opsional, HTTPS tanpa query identitas/pelacakan; klik tidak wajib |

**Mengukur file asli:** jalankan `ffprobe -v error -show_entries format=duration:stream=codec_name,codec_type,width,height -of json assets/sponsors/<id>/<file>.mp4`. Validasi otomatis juga memeriksa SHA-256, ukuran, codec, dimensi, dan file asli; tidak cukup hanya nilai JSON yang diklaim sponsor. Jika `ffprobe` tidak tersedia saat ada kampanye approved, validasi gagal (fail-closed).

**Pemutaran:** tombol putar dapat diperlukan jika autoplay diblokir; tersedia pause, replay, subtitle dan kontrol suara yang dapat diakses; fitur scrub/speed tidak disediakan sebagai cara normal melompati iklan. Sesi baru **setiap tindakan**, bukan setiap klik ganda yang masih memproses tindakan sebelumnya. Durasi media saja **bukan** bukti terverifikasi bahwa pengguna menonton: validasi sesi/receipt server dibuat pada MON-03–MON-05.

## Penyaringan materi
Dilarang iklan yang tidak sesuai lingkungan sekolah atau berisiko bagi anak: judi, konten seksual dewasa, alkohol, nikotin, zat ilegal, senjata, klaim kesehatan/pendapatan menyesatkan, produk kredit tak aman, kampanye politik dan penipuan. Buktikan izin merek, musik, talent, dan kepemilikan hasil produksi. Jangan menggunakan wajah/identitas anak tanpa izin sah.

## Cara mendaftarkan materi
1. Simpan kontrak yang **ditandatangani** dan bukti hak di tempat privat.
2. Tempatkan video/caption/poster yang telah dipindai antivirus pada `assets/sponsors/<id>/`.
3. Dapatkan hash SHA-256 dari file final; masukkan data ke `config/sponsor-campaigns.json`.
4. Status awal selalu `draft` atau `in_review` dengan `enabled:false`.
5. Moderator meninjau konten, klaim, lisensi, privasi, serta memutar seluruh video.
6. Operator kedua menyetujui kampanye setelah seluruh pemeriksaan, mengisi referensi kontrak/tanggal dan flags persetujuan berdasarkan bukti.
7. Jalankan `npm run check:sponsor` lalu `npm run check`. Kampanye approved yang kehilangan file/ffprobe atau hash ditolak oleh CI.
8. **Jangan** mengaktifkan `enabled:true` hingga backend receipt, gate, pengujian, perlindungan PWA, dan persyaratan rilis MON-08 lulus.

**Ketentuan laporan:** penyediaan materi yang memenuhi standar dan kontrak resmi masih pekerjaan eksternal. Stage MON-02 tidak menciptakan iklan sponsor fiktif.
