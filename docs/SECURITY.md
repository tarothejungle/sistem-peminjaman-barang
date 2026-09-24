# Security & Logic Constraints

Berlaku untuk kode pada 2026-09-18. Sumber kebenaran: `bootstrap/app.php`, `app/Http/Middleware/`, `app/Providers/AppServiceProvider.php`, `config/jwt.php`, `config/cors.php`, `config/services.php`.

## 1. Model Autentikasi

Sistem memakai JWT untuk access token, tetapi **sesi tetap punya state di server** lewat tabel `auth_sessions`.

| Aspek | Nilai |
| --- | --- |
| Access token | JWT, `JWT_ACCESS_TTL_SECONDS` (default 1800 detik), dikirim via header `Authorization: Bearer` |
| Refresh token | Opaque JWT dengan `sid` sesi, dikirim sebagai cookie |
| Cookie refresh | `HttpOnly`, `SameSite=Strict`, `Path=/api/v1/auth`, `Secure` mengikuti `JWT_REFRESH_COOKIE_SECURE` |
| Umur refresh | `JWT_REFRESH_TTL_SECONDS` (default 604800 detik) |
| Penyimpanan refresh | hanya hash SHA-256 di `auth_sessions.refresh_token_hash` |
| Batas tidak aktif | `AUTH_INACTIVITY_TIMEOUT_MINUTES` (default contoh 30 menit), ditegakkan di server |

Konsekuensi yang disengaja: setiap request ber-middleware `jwt` membaca satu baris `auth_sessions`. Ini yang memungkinkan pencabutan sesi dan penegakan batas tidak aktif, yang tidak bisa dilakukan JWT stateless murni.

### Rotasi dan deteksi replay

`AuthSessionService::rotate()` mengunci baris sesi (`lockForUpdate`), lalu membandingkan hash refresh token yang masuk. Bila tidak cocok, sesi **langsung dicabut** (`revoked_at` diisi) dan response `401`. Token lama tidak bisa dipakai dua kali.

### Heartbeat

`POST /auth/activity` memperbarui `last_activity_at`. Penulisan dibatasi `AUTH_ACTIVITY_WRITE_INTERVAL_SECONDS` (default 60 detik) supaya polling klien tidak membanjiri database.

### Validasi konfigurasi saat boot

`AppServiceProvider::boot()` menolak aplikasi yang salah konfigurasi, bukan gagal diam-diam:

- `JWT_*_TTL` dan `inactivity_ttl` harus bilangan positif
- `JWT_ACCESS_TTL_SECONDS` harus `>=` batas tidak aktif
- `JWT_ACCESS_SECRET` dan `JWT_REFRESH_SECRET` harus acak, minimal 32 karakter, **berbeda satu sama lain**, dan lolos `JwtService::isWeakSecret()`
- Bila Turnstile aktif, `TURNSTILE_SITE_KEY` dan `TURNSTILE_SECRET_KEY` wajib terisi

## 2. Otorisasi (RBAC)

Role: `PEMOHON`, `PJ_RUANGAN`, `KABAG_UMUM`, `KASUBAG_UMUM`.

- `Role::administrators()` = `KABAG_UMUM` + `KASUBAG_UMUM`
- `Role::approvers()` = `KASUBAG_UMUM` saja. `KABAG_UMUM` adalah administrator penuh untuk master data dan pengguna, tetapi pada antrean approval hanya memantau. Menambah `KABAG_UMUM` ke `approvers()` mengubah arti alur, bukan sekadar melonggarkan izin.
- Middleware `role` memeriksa `auth_role` yang sudah diisi middleware `jwt`; role tidak pernah dibaca dari payload request.
- Endpoint manajemen pengguna menurunkan role dari rute. Hanya `department-heads` yang menerima field `role`, dan nilainya dibatasi ke `KABAG_UMUM` atau `KASUBAG_UMUM`, sehingga role tidak bisa dieskalasi lewat body.
- `GET /bookings/{id}/document` mengembalikan `404` (bukan `403`) ketika pemanggil bukan owner, PJ, maupun administrator, agar keberadaan berkas tidak bocor lewat perbedaan kode status.
- Endpoint informasi (`/attention-messages`) memfilter feed berdasarkan role yang sedang login, bukan berdasarkan parameter request; CRUD-nya khusus administrator. Pengumuman nonaktif tidak pernah ikut terkirim ke klien biasa. Feed pra-login (`/attention-messages/public`) bersifat anonim: ia hanya mengembalikan pesan aktif ber-`placement BEFORE_LOGIN`, tanpa data role pemanggil.
- Mode maintenance tidak membuka celah: `EnsureSiteIsAvailable` menolak request `api/*` dengan `503`, kecuali `/health`, `/maintenance`, `/attention-messages/public`, `/auth/*`, dan request ber-token administrator — supaya orang yang menyalakan saklar masih bisa mematikannya. Probe administrator bersifat read-only dan hanya berjalan saat maintenance aktif.

## 3. Perlindungan Kredensial

- Password di-hash dengan bcrypt (`Hash::make`). Kolom `password_hash` ada di `$hidden` sehingga tidak pernah ikut response.
- Panjang password: minimal 12 karakter, maksimal 72 byte (batas bcrypt). Berlaku untuk ganti password, reset password, dan pembuatan pengguna oleh administrator.
- Password baru wajib berbeda dari password lama.
- **Anti-enumerasi akun:** saat username tidak ditemukan, login tetap menjalankan `Hash::check` terhadap hash dummy sehingga waktu respons seragam. Pesan galatnya generik.
- `POST /auth/forgot-password` selalu mengembalikan pesan yang sama, ada atau tidak adanya email terdaftar.
- Token reset password berupa 64 karakter hex, disimpan hanya sebagai hash, punya masa berlaku, dan ditandai `used_at` saat dipakai.
- Setelah password berhasil diganti, seluruh sesi pengguna dicabut (`revokeAllForUser`) dan token reset yang belum terpakai ditutup.

## 4. Rate Limiting

Didefinisikan di `AppServiceProvider::boot()`.

| Limiter | Batas |
| --- | --- |
| `auth-login` | 30/menit per IP, ditambah `AUTH_LOGIN_MAX_ATTEMPTS` per detik untuk kombinasi IP+username, dan `AUTH_LOGIN_ACCOUNT_MAX_ATTEMPTS` per 15 menit per akun |
| `auth-refresh` | `AUTH_REFRESH_MAX_ATTEMPTS` per menit per IP |
| `auth-password` | `AUTH_PASSWORD_MAX_ATTEMPTS` per menit per IP+user |
| `auth-forgot-password` | 5 per 15 menit per IP dan 3 per 15 menit per email |
| `auth-reset-password` | 20 per 15 menit per IP |
| `booking-create` | `BOOKING_CREATE_MAX_ATTEMPTS` per menit per user |
| `/display/rooms` | 60 per menit |

## 5. Origin dan CORS

`RequireBrowserOrigin` memvalidasi header `Origin` (fallback `Referer`) terhadap `APP_URL` dan `FRONTEND_URL`. Bypass localhost hanya berlaku saat `APP_ENV=local` dan host request adalah `localhost`, `127.0.0.1`, atau `::1`. Request yang tidak lolos mendapat `403` dengan pesan `Origin tidak diizinkan`.

`config/cors.php` hanya membuka path `api/*`, `supports_credentials = true`, dan `allowed_origins` berisi `FRONTEND_URL`.

Di produksi `APP_URL` dan `FRONTEND_URL` harus berisi origin HTTPS sebenarnya. Salah isi berarti seluruh request API ditolak `403`.

## 6. Security Headers

`SecurityHeaders` terpasang global untuk semua response:

- `Content-Security-Policy`: `default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `img-src 'self' data: blob:`, dan `connect-src 'self'`. `script-src` mengizinkan `'self'` plus `https://challenges.cloudflare.com`; setiap inline script pada response HTML dihitung hash SHA-256-nya dan ditambahkan ke CSP secara otomatis.
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`
- `Cache-Control: private, no-store` khusus path `api/*`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` hanya saat production

## 7. Pengerasan Production

`AppServiceProvider::assertProductionHardening()` menggagalkan boot bila salah satu tidak terpenuhi:

- `APP_DEBUG=false`
- `JWT_REFRESH_COOKIE_SECURE=true`
- `MAIL_MAILER` bukan `log` atau `array`
- `APP_URL`, `FRONTEND_URL`, dan URL reset password semuanya memakai `https://`
- PostgreSQL remote memakai `DB_SSLMODE` `require`, `verify-ca`, atau `verify-full`; mode `disable`, `allow`, dan `prefer` ditolak untuk host non-lokal

Cloudflare Turnstile aktif **otomatis** saat `APP_ENV=production` (`config/services.php`). Bila key kosong, aplikasi menolak boot. Konsekuensinya: produksi tanpa `TURNSTILE_SITE_KEY` dan `TURNSTILE_SECRET_KEY` membuat login tidak bisa dipakai sama sekali.

## 8. Unggahan Berkas

| Jenis | Batas | Validasi |
| --- | --- | --- |
| Gambar ruangan/barang | 5 MB | `mimes:jpg,jpeg,png,webp` **dan** `mimetypes:image/jpeg,image/png,image/webp` |
| Foto profil | 2 MB | idem |
| Surat peminjaman & Surat Tugas (PDF) | 10 MB | `mimes:pdf`, `mimetypes:application/pdf,application/x-pdf`, plus pemeriksaan signature `%PDF` agar file yang hanya mengganti ekstensi tetap ditolak |

- Berkas disimpan di disk `local` (privat) dengan nama UUID, bukan di ruang publik.
- Penyajian dilakukan lewat endpoint ber-otorisasi (`/rooms/{id}/image`, `/items/{id}/image`, `/profile/photo`, `/bookings/{id}/document`).
- Response unduhan PDF menyertakan `X-Content-Type-Options: nosniff`.
- Kolom `document_path`, `document_mime`, `surat_tugas_path`, `surat_tugas_mime`, `image_path`, `image_mime`, dan `refresh_token_hash` ada di `$hidden` model, jadi tidak pernah ikut serialisasi.

## 9. Redaksi Log

`App\Logging\RedactSensitiveData` adalah processor Monolog yang membersihkan setiap record:

- Key yang mengandung `password`, `token`, `secret`, `authorization`, `cookie`, `email`, atau `phone` diganti `[redacted]`.
- String pada message/context juga disaring: hash bcrypt, tautan reset password yang membawa token, dan header `Bearer`.
- `Throwable` diringkas menjadi kelas dan kode saja, tanpa stack trace di context.

## 10. Ekspor Laporan

- `BookingReportExporter::xlsx()` menulis setiap sel dengan tipe data **string** eksplisit (`setCellValueExplicit` + `DataType::TYPE_STRING`), bukan `fromArray()`. Tanpa itu, nilai yang diawali `=` dari kolom yang dikendalikan pemohon (mis. `Nama Peminjam`) tersimpan sebagai formula hidup dan dieksekusi saat administrator membuka berkasnya (formula injection).
- Nama berkas asli dari unggahan dibersihkan di `BookingService::originalName()`: karakter kontrol, tanda kutip, dan pemisah path dibuang sebelum masuk database maupun header `Content-Disposition`.
- Ekspor PDF memakai Dompdf dengan `setIsRemoteEnabled(false)`, dan template Blade meng-escape nilai dengan `{{ }}`.

## 11. Batas Domain Peminjaman

Aturan berikut adalah pengamanan bisnis, bukan sekadar validasi bentuk, dan ditegakkan di service:

- Pengecekan bentrok jadwal ruang memakai daftar `OVERLAP_STATUSES` di `BookingService`, bukan sekadar status `APPROVED`.
- Transisi status divalidasi terhadap status asal; tidak ada endpoint generik yang bisa melompati tahap.
- Edit dan hapus pengajuan hanya untuk pemiliknya dan hanya saat `PENDING_PJ_REVIEW`.
- Batas jumlah dan durasi pengajuan diatur lewat `BOOKING_MAX_DURATION_DAYS`, `BOOKING_MAX_FUTURE_DAYS`, dan `BOOKING_MAX_ACTIVE_PER_USER_COUNT`.
- Waktu peminjaman tidak boleh di masa lalu.
- Alternatif ruangan hanya untuk Ruang Rapat Utama dan hanya selama masa peminjaman berjalan: `relocateMainRoomBooking()` menolak (`409`) bila jam selesai yang berlaku (`COALESCE(alternative_end_time, end_time)`) sudah lewat, dan frontend menyembunyikan tombolnya di luar rentang sesi (pengajuan yang masih menunggu keputusan KASUBAG tetap bisa dialihkan sampai jadwalnya lewat).
- Ledger `user_credit_events` bersifat append-only dengan `booking_id` unik, sehingga konfirmasi selesai yang terulang tidak menggandakan perubahan skor.
- Skor kredibilitas hanya berlaku untuk akun `PEMOHON`: service menolak mencatat bila role bukan `PEMOHON`, dan API tidak pernah mengirim `creditScore` untuk role lain. Nilainya dijaga di rentang 0-100.
- Peminjaman barang yang memuat kendaraan (item dengan `plateNumber`) wajib menyertakan Surat Tugas; aturan ini ditegakkan di service, bukan hanya di frontend.