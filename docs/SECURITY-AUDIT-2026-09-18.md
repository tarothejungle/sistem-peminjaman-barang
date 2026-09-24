# Laporan Audit Keamanan — 18 September 2026

Audit statis menyeluruh (source review) atas aplikasi **Sistem Peminjaman Ruang Rapat & Kendaraan**
(`be/` Laravel 13 + PHP 8.3, `fe/` React 19 + Vite), dilanjutkan dengan perbaikan untuk setiap
temuan yang bisa diperbaiki di dalam kode, dan diakhiri dengan verifikasi ulang.

Laporan ini melanjutkan `docs/SECURITY-AUDIT-2026-09-10.md`. Aturan & jaminan keamanan yang
berlaku sehari-hari ada di `docs/SECURITY.md`; dokumen ini fokus pada hasil pemeriksaan,
temuan baru, dan tindak lanjutnya.

---

## 1. Cakupan dan metode

| Aspek | Yang dilakukan |
| --- | --- |
| Peta serangan | `php artisan route:list -v` — 72 rute diperiksa satu per satu beserta middleware-nya |
| Otentikasi & sesi | `JwtService`, `AuthSessionService`, `AuthController`, `AuthenticateJwt`, `RequireRole` |
| Otorisasi | Seluruh kontroler + middleware `role` (IDOR, eskalasi role, akses lintas pemilik) |
| Validasi input | Semua `FormRequest` (pola `StrictRequest`/`allowedFields`), rule per field |
| Injeksi | Pencarian literal `DB::raw`, `whereRaw`, `selectRaw`, `orderByRaw`, `havingRaw`, `eval`, `exec`, `shell_exec`, `unserialize`, `assert` |
| XSS | `dangerouslySetInnerHTML`, `innerHTML`, `document.write`, `new Function`, lokasi penyimpanan token di browser |
| Unggahan/unduhan berkas | Validasi MIME + signature, penyimpanan UUID di disk privat, endpoint unduhan, `Content-Disposition` |
| Berkas turunan | Ekspor XLSX (`PhpSpreadsheet`) dan PDF (`Dompdf`) — diuji langsung dengan payload nyata |
| Header & CSP | `SecurityHeaders`, `RequireBrowserOrigin`, `config/cors.php` |
| Rahasia | `git ls-files` + `git grep` untuk `.env`, kunci, token, kata sandi di berkas terlacak |
| Dependency | `composer audit`, `npm audit` (termasuk dependensi development) |
| Konfigurasi produksi | `AppServiceProvider::assertProductionHardening()`, `.env.example`, `config/*.php` |

Pemeriksaan dijalankan pada working tree saat ini, **bukan** pemindaian riwayat Git dan bukan uji
tembus (penetration test).

---

## 2. Verifikasi dasar sebelum audit

| Pemeriksaan | Hasil |
| --- | --- |
| `php artisan test` | **128 lulus / 677 assertion** |
| `vendor/bin/pint --test` | bersih |
| `npm run lint` (oxlint) | bersih |
| `npm test` (Vitest) | 21 berkas / 84 tes lulus |
| `npm run build` | sukses (− `be/public/app` terbarui) |
| `composer audit` | tidak ada advisory |
| `npm audit` | 0 kerentanan |
| `git grep` rahasia pada berkas terlacak | tidak ada `.env`, kunci, atau token ter-commit |

Tidak ditemukan masalah pada: injeksi SQL (semua query memakai binding), XSS
(React meng-escape, Blade memakai `{{ }}`, tidak ada `dangerouslySetInnerHTML`), penyimpanan token
di browser (access token hanya di memori, refresh token di cookie `HttpOnly` + `SameSite=Strict`),
IDOR (setiap endpoint memeriksa kepemilikan atau role), mass assignment (semua penulisan memakai
atribut eksplisit hasil `validated()`), traversal path pada unduhan (nama berkas UUID), SSRF pada
Dompdf (`setIsRemoteEnabled(false)`), dan kebocoran data sensitif pada serialisasi model
(`password_hash`, `*_path`, `refresh_token_hash` ada di `$hidden`).

---

## 3. Temuan dan perbaikan

| ID | Tingkat | Temuan | Perbaikan | Status |
| --- | --- | --- | --- | --- |
| AUD-01 | **Sedang** | Formula injection pada ekspor XLSX | Sel ditulis sebagai string eksplisit | **Diperbaiki + tes regresi** |
| AUD-02 | **Sedang** | Dump basis data berisi data nyata di root repositori | `.htaccess` penolak di root + prosedur deploy | **Dimitigasi (perlu tindakan operator)** |
| AUD-03 | Rendah | Panduan `TRUSTED_PROXIES=*` membuka spoofing `X-Forwarded-For` | Panduan deploy diperbaiki | **Diperbaiki (dokumentasi)** |
| AUD-04 | Rendah | `DatabaseSeeder` bisa membuat akun demo berbagi password di produksi | Seeder menolak berjalan di produksi | **Diperbaiki** |
| AUD-05 | Rendah | Cookie sesi tidak ditandai `Secure` di produksi | Default mengikuti `APP_ENV` + dokumentasi | **Diperbaiki** |
| AUD-06 | Rendah | `BOOKING_MAX_ACTIVE_PER_USER_COUNT=` (kosong) di `.env.example` | Nilai contoh diisi `10`, kunci duplikat dibuang | **Diperbaiki** |
| AUD-07 | Rendah | Nama berkas asli unggahan masuk apa adanya ke `Content-Disposition` | Nama dibersihkan saat disimpan | **Diperbaiki** |

### AUD-01 — Formula injection pada ekspor XLSX (Sedang)

**Bukti.** `BookingReportExporter::xlsx()` menulis baris dengan `Worksheet::fromArray()`. Binder
nilai bawaan PhpSpreadsheet mengubah string yang diawali `=` menjadi **formula hidup**. Uji langsung
dengan nilai `=HYPERLINK("http://evil.test","klik")` pada kolom yang dikendalikan pemohon
(`Nama Peminjam`) menghasilkan sel bertipe `f` (formula):

```
row 5 datatype=f value='=HYPERLINK("http://evil.test","klik")'
```

**Dampak.** Kolom `Nama Peminjam`, `No. Telepon`, dan `Unit Kerja` diisi pemohon. Payload seperti
`=HYPERLINK(...)`, `=WEBSERVICE(...)`, atau DDE (`=cmd|'/c calc'!A0`) akan dieksekusi/ditawarkan
saat administrator membuka berkas laporan yang diunduh dari panel kelola.

**Perbaikan.** `writeRow()` menulis setiap sel dengan `setCellValueExplicit(..., DataType::TYPE_STRING)`
sehingga seluruh isi baris (termasuk header) tersimpan sebagai teks, bukan formula.

**Verifikasi.** Tes baru `test_report_export_keeps_formula_like_values_as_text` pada
`be/tests/Feature/VehiclePlateAndReportExportTest.php` mengekspor laporan berisi payload di atas,
memuat ulang berkasnya dengan `IOFactory`, dan menuntut `DataType::TYPE_STRING` serta nilai yang
identik dengan teks aslinya. Tanpa perbaikan, sel tersebut bertipe `f` dan tes gagal.

### AUD-02 — Dump basis data di root repositori (Sedang)

**Bukti.** `dump-sistem_peminjaman-2026091101{25,26}.sql` berada di root proyek. Berkas ini
memang **tidak terlacak Git** (`.gitignore` memuat `*.sql`), tetapi tetap ada di disk. Bila proyek
diunggah apa adanya dan web root diarahkan ke folder proyek — skenario yang umum terjadi pada
shared hosting — kedua berkas ini dapat diunduh publik. Isinya adalah data operasional nyata
termasuk hash kata sandi dan data pribadi pegawai.

**Perbaikan.**
1. `.htaccess` baru di root repositori menolak akses ke `*.sql`, `*.dump`, `*.bak`, `*.env*`,
   `*.log`, `*.key`, `*.pem`, dan berkas titik lainnya, serta mematikan directory listing.
2. Panduan deploy (`docs/DEPLOYMENT.md`) mewajibkan web root diarahkan ke `be/public` dan
   menempatkan dump di luar folder aplikasi.

Catatan: seperti `docs/`, berkas `.htaccess` root belum terlacak Git pada status worktree saat ini.
Pastikan ia ikut ter-deploy, atau tambahkan ke repositori saat menyiapkan rilis.

**Sisa tindakan operator (wajib).** `.htaccess` hanya sabuk pengaman; langkah yang benar adalah
**memindahkan atau menghapus** dump tersebut dari folder proyek, dan menyimpan cadangan di lokasi
terpisah yang tidak dapat diakses publik. Bila dump pernah tersebar, rotasi kata sandi pengguna
dan pencabutan sesi perlu dikoordinasikan.

### AUD-03 — `TRUSTED_PROXIES=*` pada panduan deploy (Rendah)

**Bukti.** Panduan lama menyarankan `TRUSTED_PROXIES=*`. `bootstrap/app.php` meneruskan nilai ini
ke `trustProxies()`, dan nilai `*` membuat Laravel memercayai `X-Forwarded-For` dari **siapa pun**.

**Dampak.** `$request->ip()` menjadi nilai yang dikendalikan penyerang, sehingga limiter berbasis IP
(`auth-login` 30/menit per IP, `auth-forgot-password` 5/15 menit per IP, `auth-reset-password`,
`auth-refresh`) dapat dilewati dengan mengganti header setiap permintaan. Limiter per akun tetap
berlaku, sehingga dampaknya adalah perlambatan, bukan pembobolan akun.

**Perbaikan.** Panduan deploy kini menyuruh mengisi daftar IP/rentang proxy yang sebenarnya
(mis. `TRUSTED_PROXIES=127.0.0.1,10.0.0.0/8`), dengan peringatan eksplisit bahwa `*` hanya boleh
dipakai bila aplikasi benar-benar tidak dapat dijangkau langsung (bind ke localhost/firewall).

### AUD-04 — Seeder akun demo di produksi (Rendah)

**Bukti.** `DatabaseSeeder::run()` membuat tiga akun (`pemohon@example.test`, dst.) dengan satu
kata sandi bersama dari `SEED_DEFAULT_PASSWORD` — variabel yang tercantum di `.env.example`.
Satu `php artisan db:seed --force` di produksi dengan variabel itu terisi akan membuat akun
dengan kredensial yang diketahui.

**Perbaikan.** Seeder berhenti lebih awal dengan peringatan bila `app()->environment('production')`.
Akun nyata tetap dibuat lewat `php artisan admin:create-administrator` atau panel kelola pengguna.

### AUD-05 — Cookie sesi tanpa `Secure` di produksi (Rendah)

**Bukti.** `config/session.php`: `'secure' => env('SESSION_SECURE_COOKIE')`, dan variabel itu tidak
ada di `.env.example` sehingga bernilai `null`. Pada HTTPS, cookie sesi tetap terkirim tanpa flag
`Secure`.

**Perbaikan.** Default kini `env('SESSION_SECURE_COOKIE', env('APP_ENV') === 'production')`,
sehingga produksi otomatis `Secure` tanpa perlu mengubah `.env`, dan tetap dapat ditimpa manual.

### AUD-06 — Batas peminjaman aktif menjadi 1 tanpa sengaja (Rendah)

**Bukti.** `.env.example` memuat `BOOKING_MAX_ACTIVE_PER_USER_COUNT=` (kosong). Karena
`config/jwt.php` memakai `(int) env(...)`, nilai kosong menjadi `0`, lalu dijaga `max(1, ...)` di
`BookingService` menjadi **1**. Salinan `.env` baru dari contoh akan diam-diam membatasi setiap
pemohon hanya boleh punya satu peminjaman aktif. Baris lama `BOOKING_MAX_ACTIVE_PER_USER=10`
(tidak pernah dibaca kode) menambah kebingungan.

**Perbaikan.** Nilai contoh diisi `10`, dan kunci usang dihapus.

### AUD-07 — Nama berkas asli unggahan (Rendah)

**Bukti.** `BookingService::storeDocument()`/`storeSuratTugas()` menyimpan
`$document->getClientOriginalName()` apa adanya (hanya dipotong 255 karakter). Nama berkas
sepenuhnya dikendalikan pengunggah; karakter `\r\n` ikut tersimpan dan muncul (ter-encode
persen) pada parameter `filename*` di header `Content-Disposition` saat berkas diunduh.

**Dampak.** Tidak terjadi response splitting: Symfony meng-escape dan meng-encode nilai tersebut,
sehingga header tidak dapat dipecah. Dampaknya adalah nama berkas yang aneh pada klien dan data
kotor di basis data.

**Perbaikan.** `BookingService::originalName()` membuang karakter kontrol, tanda kutip, dan
pemisah path sebelum nama disimpan.

---

## 4. Risiko yang diterima (by design)

| Hal | Alasan | Catatan |
| --- | --- | --- |
| `GET /api/v1/display/rooms` bersifat publik | Halaman papan informasi ruang (Smart-TV) tidak punya sesi login | Isinya hanya jadwal + `purpose` ruangan. Bila dianggap sensitif, endpoint ini harus diberi token khusus perangkat |
| Feed pra-login `/attention-messages/public` | Pengumuman memang harus terbaca sebelum login | Hanya mengembalikan pesan aktif ber-`placement BEFORE_LOGIN`, tanpa data role pemanggil |
| `style-src 'unsafe-inline'` pada CSP | Diperlukan komponen UI | `script-src` tetap dibatasi `'self'` + hash inline + `challenges.cloudflare.com` |
| Probe feature-detection legacy dimuat sebagai berkas | Sebelumnya berupa `data:` URI yang memaksa `script-src data:` | Sudah diperbaiki pada audit sebelumnya; sekarang berkas nyata |
| Turnstile otomatis aktif saat `APP_ENV=production` | Mencegah login tanpa captcha di produksi | Bila key kosong aplikasi **gagal boot** (gagal keras, bukan gagal diam-diam) |

---

## 5. Batas audit ini

- **Konkurensi PostgreSQL belum diuji.** Suite fitur memakai SQLite. Perilaku serializable pada
  kuota peminjaman, jadwal bentrok, dan reset/sesi serentak perlu dijalankan di PostgreSQL nyata.
- **Infrastruktur tidak diamati.** TLS, konfigurasi proxy, SMTP, dan cron tidak diperiksa dari sini.
- **Bukan uji tembus.** Tidak ada pemindaian dinamis, fuzzing, atau pengujian beban.
- **Riwayat Git tidak dipindai.** Pemeriksaan rahasia hanya pada berkas yang ada sekarang.
- **`docs/` tidak terlacak Git**, sehingga laporan ini tidak otomatis ikut ter-push.

---

## 6. Rekomendasi lanjutan (prioritas)

1. Jalankan skenario konkurensi di PostgreSQL (kuota, jadwal bentrok, reset password bersamaan).
2. Pindahkan/ hapus dump basis data dari folder proyek; simpan cadangan terenkripsi di luar web root.
3. Ganti `TRUSTED_PROXIES` dari `*` ke daftar IP proxy sebenarnya pada setiap environment produksi.
4. Pasang rotasi kredensial terjadwal: `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` (mengakhiri semua
   sesi) dan kata sandi database, serta aktifkan backup otomatis yang diuji restore-nya.
5. Tambahkan pemantauan terpusat untuk `503 MAINTENANCE`, lonjakan `401/403/429`, dan kegagalan
   verifikasi Turnstile.
6. Pertimbangkan token perangkat untuk `/display/rooms` bila daftar pemakaian ruangan dianggap
   informasi internal.

---

## 7. Ringkasan status

- 7 temuan (2 sedang, 5 rendah); **seluruh temuan yang dapat diperbaiki di dalam kode sudah diperbaiki**
  dan diverifikasi ulang oleh suite tes.
- 2 temuan sedang: AUD-01 selesai penuh; AUD-02 dimitigasi di kode dan memerlukan tindakan operator
  pada saat deploy.
- Tidak ditemukan kerentanan kritis (mis. RCE, SQL injection, bypass otentikasi) pada permukaan
  yang diperiksa.