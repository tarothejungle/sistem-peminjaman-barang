# Panduan Deploy ke Production

> **Dokumen lengkap:** `docs/DEPLOYMENT.md` memuat panduan per target (VPS, shared hosting/cPanel,
> Docker, Apache), tabel konfigurasi `.env`, troubleshooting, backup, dan checklist keamanan.
> Berkas ini adalah versi ringkas untuk model single-server.

Checklist setup agar aplikasi **langsung jalan tanpa error** setelah di-push ke server produksi.
Model deploy: **single-server** — Laravel (`be/`) menyajikan API di `/api/v1` **dan** hasil build React (`fe/` → `be/public/app`) di `/app/`.

> Verifikasi terakhir (lokal): backend 96 test / 500 assertion ✅ · Pint ✅ · frontend build ✅ · oxlint ✅ · vitest 34 ✅

---

## ⛔ 2 Blocker yang PALING sering bikin "error di production"

Baca dua ini dulu sebelum yang lain — keduanya membuat aplikasi tampak "rusak" padahal hanya salah setup:

1. **Turnstile aktif OTOMATIS saat `APP_ENV=production`.**
   Di `be/config/services.php`: `'enabled' => env('APP_ENV') === 'production'`. Begitu env production, halaman login **wajib** captcha Cloudflare Turnstile. Kalau `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` kosong → widget tidak muncul & `captchaToken` gagal validasi / verifikasi balik 422 → **login mati total**.
   → **Solusi (pilih salah satu):**
   - **(disarankan)** Daftar Turnstile gratis di Cloudflare, daftarkan domain produksi, lalu isi `TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` di `.env`.
   - **(kalau tidak mau captcha)** Ubah baris `enabled` di `be/config/services.php` menjadi dikendalikan env, mis:
     ```php
     'enabled' => filled(env('TURNSTILE_SECRET_KEY')),
     ```
     sehingga captcha hanya aktif kalau key diisi.

2. **`APP_URL` & `FRONTEND_URL` harus = origin HTTPS produksi yang sebenarnya.**
   Middleware `RequireBrowserOrigin` + `config/cors.php` memvalidasi header `Origin` request terhadap `APP_URL`/`FRONTEND_URL`. Bypass localhost **hanya** berlaku saat `APP_ENV=local`. Kalau salah/masih `http://localhost` di produksi → **semua request API kena 403 "Origin tidak diizinkan"**.
   → Untuk single-server, isi keduanya sama: `https://domain-anda`.

---

## 1. Prasyarat server

| Komponen | Versi | Catatan |
|---|---|---|
| PHP | **8.3+** | ekstensi: `pdo_pgsql`, `mbstring`, `openssl`, `curl`, `ctype`, `fileinfo`, `tokenizer`, `xml`, `bcmath` |
| Composer | 2.x | |
| Node.js | **20+ / 22 LTS** | hanya untuk build frontend |
| PostgreSQL | **17** (16 aman) | buat database & user dulu |
| Web server | Nginx / Apache | + PHP-FPM |

Naikkan batas upload PHP (dokumen PDF ≤ 10 MB, gambar ≤ 5 MB) di `php.ini`:
```ini
upload_max_filesize = 12M
post_max_size = 12M
```

---

## 2. Langkah deploy (pertama kali)

```bash
# --- di server ---
git clone <repo-url> sistem-peminjaman-barang
cd sistem-peminjaman-barang/be

# 1) Dependency backend (mode production)
composer install --no-dev --optimize-autoloader

# 2) Siapkan .env (lihat bagian 3 untuk isinya)
cp .env.example .env
nano .env                     # isi semua nilai produksi

# 3) Generate kunci aplikasi & JWT
php artisan key:generate
php artisan auth:generate-secrets     # buat JWT_ACCESS_SECRET & JWT_REFRESH_SECRET

# 4) Build frontend → menghasilkan be/public/app
composer frontend:install             # npm ci di ../fe
composer frontend:build               # npm run build di ../fe

# 5) Migrasi database (WAJIB pakai --force di produksi)
php artisan migrate --force

# 6) Buat akun administrator pertama (role KABAG_UMUM)
php artisan admin:create-administrator
#   atau non-interaktif:
# php artisan admin:create-administrator --name="Administrator" --email="admin@domain.com"

# 7) Cache konfigurasi untuk performa (jalankan SETELAH .env final)
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache
# ringkasnya bisa: php artisan optimize
```

> **Penting soal cache:** jalankan `config:cache` **setelah** `.env` final. Kalau nanti mengubah `.env`, jalankan `php artisan optimize:clear` (atau `config:clear`) lalu cache ulang — kalau tidak, perubahan `.env` diabaikan.

> **`storage:link` TIDAK diperlukan.** Semua gambar & dokumen disimpan di disk privat (`storage/app/private`) dan disajikan lewat endpoint ber-auth, bukan symlink publik.

### Izin folder (Linux)
Pastikan web server bisa menulis ke:
```bash
chown -R www-data:www-data storage bootstrap/cache
chmod -R 775 storage bootstrap/cache
```

---

## 3. Isi `.env` produksi

Salin dari `be/.env.example`, lalu **ubah minimal nilai berikut**:

```ini
# --- Aplikasi ---
APP_NAME="Sistem Peminjaman Ruang Rapat & Kendaraan"
APP_ENV=production            # ⬅ WAJIB (mengaktifkan Turnstile, mematikan bypass origin lokal)
APP_DEBUG=false               # ⬅ WAJIB false (jangan bocorkan stack trace)
APP_KEY=                      # diisi otomatis oleh `php artisan key:generate`
APP_URL=https://domain-anda   # ⬅ origin HTTPS produksi

# --- Origin / CORS (lihat Blocker #2) ---
FRONTEND_URL=https://domain-anda   # ⬅ sama dengan APP_URL untuk single-server
TRUSTED_PROXIES=127.0.0.1   # IP/rentang proxy (mis. Nginx di mesin yang sama, atau load balancer).
                                   # JANGAN pakai "*": nilai itu membuat Laravel memercayai
                                   # X-Forwarded-For dari siapa pun sehingga batas berbasis IP
                                   # (login, lupa password, refresh) bisa dilewati.

# --- Database PostgreSQL ---
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=nama_database
DB_USERNAME=user_db
DB_PASSWORD=password_kuat
DB_TIMEZONE=UTC               # ⬅ biarkan UTC (aplikasi konversi ke Asia/Jakarta)
DB_SSLMODE=require            # ⬅ `require` untuk PostgreSQL terkelola/remote

# --- JWT (diisi oleh `auth:generate-secrets`) ---
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_TTL_SECONDS=1800
JWT_REFRESH_TTL_SECONDS=604800
JWT_REFRESH_COOKIE_SECURE=true     # ⬅ WAJIB true di HTTPS (cookie refresh token)

# --- Cloudflare Turnstile (lihat Blocker #1) ---
TURNSTILE_SITE_KEY=your_site_key       # ⬅ wajib di production, atau patch config/services.php
TURNSTILE_SECRET_KEY=your_secret_key

# --- Email reset password ---
# Default MAIL_MAILER=log => email TIDAK terkirim (hanya ke storage/logs/laravel.log).
# Untuk fitur "lupa password" beneran jalan, set SMTP:
MAIL_MAILER=smtp
MAIL_HOST=smtp.provider.com
MAIL_PORT=587
MAIL_USERNAME=akun_smtp
MAIL_PASSWORD=password_smtp
MAIL_FROM_ADDRESS="no-reply@domain-anda"
MAIL_FROM_NAME="${APP_NAME}"
PASSWORD_RESET_URL=            # opsional; default mengikuti FRONTEND_URL

# --- Batas & keamanan (default sudah aman, ubah bila perlu) ---
AUTH_INACTIVITY_TIMEOUT_MINUTES=30
BOOKING_ROOM_AUTO_CONFIRM_MINUTES=120   # menit; 0 = nonaktif. Auto-tutup peminjaman ruang yang tak dikonfirmasi
# Rate limit login/refresh/booking sudah aktif bawaan (AUTH_LOGIN_MAX_ATTEMPTS, dst.)

# --- Driver (file cukup untuk single-server; Redis opsional) ---
SESSION_DRIVER=file
SESSION_SECURE_COOKIE=true    # default sudah true saat APP_ENV=production
CACHE_STORE=file
QUEUE_CONNECTION=sync
FILESYSTEM_DISK=local
```

Frontend (`fe/.env`) cukup — dan tidak perlu diubah untuk single-server:
```ini
VITE_API_BASE_URL=/api/v1
```
(Site key Turnstile diambil frontend saat runtime dari backend, jadi tidak perlu env VITE khusus.)

---

## 4. Web server (Nginx)

Arahkan `root` ke **`be/public`**. SPA deep-link (mis. refresh di `/app/dashboard`) sudah ditangani route fallback Laravel, jadi konfigurasi Nginx cukup standar Laravel:

```nginx
server {
    listen 443 ssl http2;
    server_name domain-anda;

    root /var/www/sistem-peminjaman-barang/be/public;
    index index.php;

    client_max_body_size 12M;          # ⬅ agar upload PDF/gambar tidak kena 413

    # ssl_certificate ... ; ssl_certificate_key ... ;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        fastcgi_pass unix:/run/php/php8.3-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }

    location ~ /\.(?!well-known).* { deny all; }
}
```
> Apache: cukup arahkan DocumentRoot ke `be/public`, `.htaccess` bawaan Laravel sudah ada, aktifkan `mod_rewrite`.

---

## 5. Scheduler (cron) — pembersihan log & auto-konfirmasi peminjaman ruang

Aplikasi menjadwalkan `login-activities:prune` (tiap jam) dan `bookings:auto-confirm-rooms` (tiap menit). Supaya benar-benar jalan, tambahkan **satu** cron di server:

```cron
* * * * * cd /var/www/sistem-peminjaman-barang/be && php artisan schedule:run >> /dev/null 2>&1
```
(Bukan blocker untuk login, tapi tanpa ini tabel login activity tumbuh terus **dan peminjaman ruang yang tidak dikonfirmasi pemohon tidak pernah ditutup otomatis** — lihat `BOOKING_ROOM_AUTO_CONFIRM_MINUTES`.)

---

## 6. Smoke test setelah deploy

```bash
curl -i https://domain-anda/up            # health check Laravel → 200
curl -i https://domain-anda/api/v1/health # health API → 200 JSON
```
Lalu buka `https://domain-anda/app/` → halaman login harus muncul (dengan widget Turnstile bila diaktifkan) → coba login pakai akun administrator.

Kalau muncul **503 "Frontend belum dibangun"** → build frontend belum dijalankan (`composer frontend:build`).
Kalau `/api/v1/health` gagal dengan pesan **database tidak terhubung** → nilai `DB_*` di `.env` produksi salah atau cache config belum di-refresh (`php artisan optimize:clear`).
Kalau login **403 "Origin tidak diizinkan"** → `APP_URL`/`FRONTEND_URL` salah (Blocker #2).
Kalau login gagal captcha → key Turnstile belum diisi (Blocker #1).

---

## 7. Redeploy (update versi berikutnya)

```bash
cd /var/www/sistem-peminjaman-barang
git pull
cd be
composer install --no-dev --optimize-autoloader
composer frontend:install && composer frontend:build
php artisan migrate --force
php artisan optimize:clear && php artisan optimize   # refresh cache config/route/view
```

---

## 8. Checklist ringkas ✅

- [ ] `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL=https://…`
- [ ] `FRONTEND_URL` = origin produksi (Blocker #2)
- [ ] `TRUSTED_PROXIES` diisi dengan IP/rentang proxy nyata bila di belakang proxy/HTTPS terminator (**bukan `*`**)
- [ ] Web root diarahkan ke `be/public`, tanpa dump `.sql`/berkas `.env` di dalamnya
- [ ] `php artisan key:generate` + `auth:generate-secrets` dijalankan
- [ ] `JWT_REFRESH_COOKIE_SECURE=true` (karena HTTPS)
- [ ] `TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` diisi **atau** config Turnstile dipatch (Blocker #1)
- [ ] DB dibuat, `migrate --force` sukses
- [ ] `composer frontend:build` → `be/public/app/index.html` ada
- [ ] SMTP diisi bila fitur reset password dipakai
- [ ] `client_max_body_size 12M` + `upload_max_filesize`/`post_max_size` ≥ 12M
- [ ] Cron `schedule:run` terpasang (wajib bila `BOOKING_ROOM_AUTO_CONFIRM_MINUTES` > 0)
- [ ] Perizinan `storage/` & `bootstrap/cache/` writable
- [ ] `php artisan optimize` dijalankan setelah `.env` final
- [ ] Smoke test `/up`, `/api/v1/health`, dan login lolos

---

## Opsional (bukan blocker, peningkatan)

- **Performa bundel:** shader WebGL halaman login memakai WebGL2 native dan dimuat secara lazy; shell authenticated serta halaman besar juga dipisah per route. Build terverifikasi tanpa peringatan chunk >500 kB (`index` modern ~382 kB / gzip ~116 kB; legacy ~461 kB / gzip ~136 kB).
- **Backup:** jadwalkan `pg_dump` berkala. Simpan berkas cadangan **di luar** folder proyek dan di
  luar web root â€” dump `.sql` yang tertinggal di folder proyek bisa terunduh bila web root salah arah.
- **Monitoring:** integrasikan logging error terpusat (mis. Sentry) — handler sudah `report()` ke log Laravel.
- **Redis:** ganti `CACHE_STORE`/`SESSION_DRIVER`/`QUEUE_CONNECTION` ke Redis bila trafik tinggi (opsional).
