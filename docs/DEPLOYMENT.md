# Panduan Deploy & Konfigurasi Produksi

Panduan ini berlaku untuk aplikasi **Sistem Peminjaman Ruang Rapat & Kendaraan** pada bentuk
repository saat ini: backend Laravel di `be/`, frontend React di `fe/`.

> Ringkasan audit keamanan terakhir: `docs/SECURITY-AUDIT-2026-09-18.md`.
> Aturan keamanan yang berlaku di kode: `docs/SECURITY.md`.

---

## 0. Model deploy

Model yang didukung: **single-server**. Laravel menyajikan API sekaligus berkas hasil build React.

```
https://domain-anda/            -> SPA React  (dari be/public/app/index.html)
https://domain-anda/api/v1/...  -> API Laravel
```

- **Web root WAJIB diarahkan ke `be/public`**, bukan ke root repositori.
- `storage:link` tidak diperlukan: gambar dan PDF disimpan di disk privat (`storage/app/private`)
  dan disajikan lewat endpoint ber-otorisasi.
- Backend dan frontend harus berada dalam satu origin. Memisahkannya ke dua domain menuntut
  penyesuaian `APP_URL`, `FRONTEND_URL`, dan CORS; panduan ini mengasumsikan satu origin.

### Prasyarat keras

| Komponen | Versi | Catatan |
| --- | --- | --- |
| PHP | **8.3+** | ekstensi: `pdo_pgsql`, `mbstring`, `openssl`, `curl`, `ctype`, `fileinfo`, `tokenizer`, `xml`, `bcmath`, `gd`/`imagick` (opsional untuk manipulasi gambar) |
| Composer | 2.x | |
| PostgreSQL | **16 atau 17** | **Wajib PostgreSQL.** Skema memakai tipe/kolom khas PostgreSQL; MySQL/MariaDB tidak didukung |
| Node.js | 20 / 22 LTS | hanya untuk membangun frontend; tidak diperlukan di server bila build diunggah dari lokal |
| Web server | Nginx / Apache + PHP-FPM | |

Batas unggah PHP (PDF ≤ 10 MB, gambar ≤ 5 MB):

```ini
upload_max_filesize = 12M
post_max_size = 12M
```

---

## 1. Konfigurasi `.env`

Salin `be/.env.example` menjadi `be/.env`, lalu sesuaikan. Nilai di bawah adalah yang **wajib**
ditinjau untuk produksi.

```ini
# --- Aplikasi ---
APP_NAME="Sistem Peminjaman Ruang Rapat & Kendaraan"
APP_ENV=production                 # mematikan bypass origin lokal & mengaktifkan Turnstile
APP_DEBUG=false                    # WAJIB false
APP_KEY=                           # diisi oleh: php artisan key:generate
APP_URL=https://domain-anda        # origin HTTPS sebenarnya
FRONTEND_URL=https://domain-anda   # sama dengan APP_URL untuk single-server

# --- Proxy / TLS (lihat catatan di bawah) ---
TRUSTED_PROXIES=127.0.0.1          # daftar IP/rentang proxy. JANGAN pakai "*"

# --- Database ---
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=nama_database
DB_USERNAME=user_db
DB_PASSWORD=kata_sandi_kuat
DB_TIMEZONE=UTC
DB_SSLMODE=require                 # WAJIB untuk database remote/terkelola

# --- JWT (diisi oleh php artisan auth:generate-secrets) ---
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_TTL_SECONDS=1800
JWT_REFRESH_TTL_SECONDS=604800
JWT_REFRESH_COOKIE_SECURE=true     # WAJIB true karena HTTPS

# --- Turnstile (wajib saat APP_ENV=production) ---
TURNSTILE_SITE_KEY=isi_dari_cloudflare
TURNSTILE_SECRET_KEY=isi_dari_cloudflare

# --- Email reset password ---
MAIL_MAILER=smtp
MAIL_HOST=smtp.provider.com
MAIL_PORT=587
MAIL_USERNAME=akun_smtp
MAIL_PASSWORD=kata_sandi_smtp
MAIL_FROM_ADDRESS="no-reply@domain-anda"
MAIL_FROM_NAME="${APP_NAME}"

# --- Sesi & driver ---
SESSION_DRIVER=file
SESSION_SECURE_COOKIE=true          # default sudah true saat APP_ENV=production
CACHE_STORE=file
QUEUE_CONNECTION=sync
FILESYSTEM_DISK=local

# --- Batas aplikasi (default aman; ubah bila perlu) ---
AUTH_INACTIVITY_TIMEOUT_MINUTES=30
AUTH_LOGIN_MAX_ATTEMPTS=5
AUTH_LOGIN_ACCOUNT_MAX_ATTEMPTS=15
BOOKING_MAX_ACTIVE_PER_USER_COUNT=10
BOOKING_MAX_DURATION_DAYS=7
BOOKING_MAX_FUTURE_DAYS=180

# --- Auto-konfirmasi peminjaman ruang ---
# Menit setelah jam selesai pemakaian ruang sebelum sistem menutup peminjaman
# sendiri. 0 = fitur dimatikan. Membutuhkan cron schedule:run (bagian 2.6).
BOOKING_ROOM_AUTO_CONFIRM_MINUTES=120
```

Frontend (`fe/.env`) tetap:

```ini
VITE_API_BASE_URL=/api/v1
```

### Catatan konfigurasi penting

1. **`APP_ENV=production` mengaktifkan Cloudflare Turnstile secara otomatis**
   (`config/services.php`). Bila `TURNSTILE_SITE_KEY`/`TURNSTILE_SECRET_KEY` kosong, aplikasi
   **menolak boot**. Artinya produksi tanpa captcha = login mati total. Daftarkan domain di
   Cloudflare Turnstile (gratis) lalu isi kedua key, atau ubah baris `enabled` pada
   `config/services.php` menjadi `filled(env('TURNSTILE_SECRET_KEY'))` bila memang tidak ingin captcha.
2. **`APP_URL` dan `FRONTEND_URL` harus origin HTTPS sebenarnya.** Middleware `RequireBrowserOrigin`
   memvalidasi header `Origin` terhadap keduanya; bypass localhost hanya berlaku saat `APP_ENV=local`.
   Salah isi berarti semua request API dibalas `403 Origin tidak diizinkan`.
3. **`TRUSTED_PROXIES` jangan diisi `*`.** Nilai `*` membuat Laravel memercayai `X-Forwarded-For`
   dari siapa pun, sehingga pembatasan berbasis IP dapat dilewati. Isi IP proxy yang sebenarnya,
   mis. `127.0.0.1` (Nginx di mesin yang sama) atau rentang jaringan load balancer. Gunakan `*`
   hanya bila aplikasi benar-benar tidak dapat dijangkau langsung (bind ke localhost/firewall).
4. **`DB_SSLMODE=require`** untuk PostgreSQL remote/terkelola (`verify-ca`/`verify-full` lebih baik
   bila berkas CA tersedia). Aplikasi menolak boot bila host non-lokal memakai mode `disable`,
   `allow`, atau `prefer`.
5. **Jangan pernah menaruh dump basis data (`.sql`) di dalam folder proyek.** Simpan cadangan di
   lokasi terpisah di luar web root.
6. `php artisan key:generate` **hanya sekali** di awal. Menggantinya membuat data terenkripsi dan
   email antrean lama tidak terbaca.

---

## 2. Jalur A — VPS Linux (Nginx + PHP-FPM + PostgreSQL)

Target: Ubuntu 22.04/24.04 atau Debian 12.

### 2.1 Paket

```bash
sudo apt update
sudo apt install -y nginx postgresql postgresql-contrib \
  php8.3-fpm php8.3-pgsql php8.3-mbstring php8.3-xml php8.3-curl php8.3-zip php8.3-bcmath php8.3-gd
```

### 2.2 Database

```bash
sudo -u postgres psql
CREATE DATABASE sistem_peminjaman;
CREATE USER peminjaman_app WITH PASSWORD 'kata-sandi-kuat';
GRANT ALL PRIVILEGES ON DATABASE sistem_peminjaman TO peminjaman_app;
\c sistem_peminjaman
GRANT ALL ON SCHEMA public TO peminjaman_app;
\q
```

### 2.3 Ambil kode & siapkan aplikasi

```bash
sudo mkdir -p /var/www && cd /var/www
git clone <repo-url> sistem-peminjaman-barang
cd sistem-peminjaman-barang/be

composer install --no-dev --optimize-autoloader
cp .env.example .env
nano .env                              # isi nilai produksi sesuai bagian 1
php artisan key:generate
php artisan auth:generate-secrets       # mengisi JWT_ACCESS_SECRET & JWT_REFRESH_SECRET

composer frontend:install               # npm ci di ../fe
composer frontend:build                 # menghasilkan be/public/app

php artisan migrate --force
php artisan admin:create-administrator
php artisan optimize                    # cache config/route/view
```

### 2.4 Izin folder

```bash
sudo chown -R www-data:www-data storage bootstrap/cache
sudo chmod -R 775 storage bootstrap/cache
```

### 2.5 Virtual host Nginx

```nginx
server {
    listen 80;
    server_name domain-anda;
    root /var/www/sistem-peminjaman-barang/be/public;
    index index.php;
    client_max_body_size 12M;

    location / { try_files $uri $uri/ /index.php?$query_string; }

    location ~ \.php$ {
        fastcgi_pass unix:/run/php/php8.3-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }

    location ~ /\.(?!well-known).* { deny all; }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/sistem-peminjaman /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d domain-anda          # TLS + redirect HTTPS
```

Karena TLS dihentikan di Nginx pada mesin yang sama, `TRUSTED_PROXIES=127.0.0.1` sudah benar.

### 2.6 Scheduler (cron)

```cron
* * * * * cd /var/www/sistem-peminjaman-barang/be && php artisan schedule:run >> /dev/null 2>&1
```

Tanpa ini dua hal berhenti bekerja: tabel `login_activities` tumbuh tanpa batas
(`login-activities:prune` dijadwalkan tiap jam) dan **peminjaman ruang yang tidak dikonfirmasi
pemohon tidak pernah ditutup otomatis** (`bookings:auto-confirm-rooms` dijadwalkan tiap menit).
Jadi cron sekarang wajib bila `BOOKING_ROOM_AUTO_CONFIRM_MINUTES` diaktifkan.

> **Saat mengembangkan di lokal (Windows/Laragon):** `php artisan schedule:run` hanya menjalankan
> tugas yang jatuh tempo **saat itu juga** lalu keluar. Untuk membuatnya berjalan terus, buka
> terminal terpisah dan biarkan `php artisan schedule:work` hidup selama pengujian. Di Windows
> tanpa Laragon, padanannya adalah Task Scheduler dengan pemicu tiap 1 menit.

### 2.7 Pengerasan server

```bash
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable
sudo apt install -y fail2ban            # opsional, untuk brute force SSH
# Sembunyikan versi PHP
sudo sed -i 's/^expose_php = On/expose_php = Off/' /etc/php/8.3/fpm/php.ini
sudo systemctl restart php8.3-fpm
```

Pastikan port PostgreSQL tidak terbuka ke internet, dan `display_errors=Off` pada produksi.

---

## 3. Jalur B — Shared hosting / cPanel

### 3.1 Kenyataan yang harus diterima lebih dulu

| Kebutuhan | Konsekuensi bila tidak tersedia |
| --- | --- |
| **PostgreSQL** | Aplikasi **tidak bisa jalan**; paket shared hosting yang hanya menyediakan MySQL/MariaDB tidak memenuhi syarat. Pastikan ada PostgreSQL sebelum membeli paket |
| **PHP 8.3+** yang dapat dipilih per domain | Ganti versi lewat "MultiPHP Manager" di cPanel |
| **Composer** (atau unggah `vendor/` dari lokal) | Tanpa Composer, jalankan `composer install --no-dev --optimize-autoloader` di lokal lalu unggah folder `vendor/` |
| **Kemampuan mengarahkan document root** | Bila tidak bisa, pakai trik layout di 3.2 |
| **Cron job** | Tabel login activity tidak pernah dibersihkan **dan auto-konfirmasi peminjaman ruang tidak berjalan** |
| **Akses keluar (outbound HTTPS)** | Verifikasi Turnstile gagal → login mati. Bila diblokir, jangan aktifkan Turnstile |
| **Node.js** | Tidak perlu: bangun frontend di komputer lokal, unggah hasilnya |

### 3.2 Layout direktori

**Pilihan terbaik — document root diarahkan ke `be/public`:**
buat subdomain/addon domain, lalu set Document Root ke `/home/user/sistem-peminjaman-barang/be/public`.

**Bila document root terkunci (mis. `public_html` wajib):** simpan aplikasi **di luar** `public_html`
dan isi `public_html` hanya dengan isi `be/public`.

```
/home/user/
├── sistem-peminjaman-barang/        <- seluruh repositori (di luar web root)
│   ├── be/                          <- aplikasi Laravel
│   └── fe/
└── public_html/                     <- document root domain
    ├── index.php                    <- salinan be/public/index.php (path disesuaikan)
    ├── .htaccess                    <- salinan be/public/.htaccess
    ├── favicon.ico
    ├── robots.txt
    └── app/                         <- hasil build React (be/public/app)
```

Ubah `public_html/index.php` menjadi:

```php
<?php

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

if (file_exists($maintenance = __DIR__.'/../sistem-peminjaman-barang/be/storage/framework/maintenance.php')) {
    require $maintenance;
}

require __DIR__.'/../sistem-peminjaman-barang/be/vendor/autoload.php';

/** @var Application $app */
$app = require_once __DIR__.'/../sistem-peminjaman-barang/be/bootstrap/app.php';

$app->handleRequest(Request::capture());
```

`bootstrap/app.php` menentukan base path relatif terhadap lokasinya sendiri, jadi path aplikasi
tetap benar. Halaman SPA dibaca Laravel dari `be/public/app/index.html`, sehingga folder `app/`
**wajib ada di dalam `be/public`**, bukan hanya di `public_html`.

### 3.3 Langkah deploy

1. **Bangun frontend di lokal** (butuh Node 20/22):

   ```bash
   cd fe && npm ci && npm run build     # hasil ke be/public/app
   ```

2. **Unggah proyek** ke `/home/user/sistem-peminjaman-barang` (File Manager atau SFTP).
   Jangan unggah `fe/node_modules`, `be/node_modules`, `fe/dist`, dan berkas `.sql`.
3. **Composer**: jalankan dari Terminal cPanel, atau unggah folder `vendor/` hasil `composer install --no-dev --optimize-autoloader` di lokal.
4. **Buat `.env`** dari `.env.example`, isi sesuai bagian 1, lalu:

   ```bash
   cd ~/sistem-peminjaman-barang/be
   /usr/local/bin/php artisan key:generate
   /usr/local/bin/php artisan auth:generate-secrets   # atau isi manual dua secret acak ≥32 karakter
   /usr/local/bin/php artisan migrate --force
   /usr/local/bin/php artisan admin:create-administrator
   /usr/local/bin/php artisan optimize
   ```

   Bila Terminal tidak tersedia, minta penyedia menjalankan perintah tersebut, atau jalankan migrasi
   dari komputer lokal dengan mengarahkan `DB_HOST` ke database hosting.
5. **Salin isi `be/public` ke `public_html`** bila document root tidak dapat diubah (lihat 3.2),
   dan sesuaikan `index.php`.
6. **Izin berkas**: `storage/` dan `bootstrap/cache/` harus dapat ditulis (umumnya `755` dengan
   pemilik akun hosting sudah cukup; `775` bila web server berjalan sebagai user lain).
7. **Batas unggah** lewat "MultiPHP INI Editor" atau berkas `.user.ini` di `public_html`:

   ```ini
   upload_max_filesize = 12M
   post_max_size = 12M
   ```

8. **Cron** dari cPanel → Cron Jobs:

   ```
   * * * * * /usr/local/bin/php /home/user/sistem-peminjaman-barang/be/artisan schedule:run >> /dev/null 2>&1
   ```

### 3.4 Keterbatasan yang perlu disadari

- Tanpa SSH, `php artisan optimize` dan `migrate` sulit dijalankan; minta bantuan penyedia.
- Beberapa hosting memblokir koneksi keluar ke `challenges.cloudflare.com`, membuat Turnstile
  gagal verifikasi. Uji dulu sebelum mengaktifkan produksi.
- `queue:work` biasanya tidak tersedia; `QUEUE_CONNECTION=sync` sudah sesuai (email reset dikirim
  langsung saat request).
- Bila hosting memakai LiteSpeed/Apache, `.htaccess` bawaan Laravel sudah menangani rewrite.

---

## 4. Jalur C — Docker / container

Kontainer memerlukan dua proses pada image yang sama: PHP-FPM (aplikasi) dan Nginx, atau satu
image dengan `php artisan serve` untuk skala kecil (tidak disarankan untuk produksi).

```dockerfile
FROM php:8.3-fpm

RUN apt-get update && apt-get install -y \
      libpq-dev unzip git libpng-dev libzip-dev \
 && docker-php-ext-install pdo_pgsql gd zip bcmath \
 && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app
COPY . .
RUN composer install --no-dev --optimize-autoloader \
 && chown -R www-data:www-data storage bootstrap/cache
```

Catatan penting:

- **Build frontend sebelum membangun image** (`cd fe && npm ci && npm run build`) supaya
  `be/public/app` sudah ada dan ikut tersalin. Jangan mengandalkan Node di dalam image produksi.
- Sajikan hanya `be/public` (mis. Nginx `root /app/be/public`).
- `storage/` harus volume persisten, kalau tidak semua berkas unggahan hilang saat redeploy.
- Jalankan `php artisan migrate --force` sebagai langkah rilis, bukan saat boot kontainer, agar
  beberapa replika tidak bermigrasi bersamaan.
- Set `TRUSTED_PROXIES` ke rentang jaringan container/ingress, bukan `*`.

Untuk platform terkelola (Railway/Render/Fly.io/dsb.): perlakukan sama seperti VPS — butuh
PostgreSQL terkelola (`DB_SSLMODE=require`), perintah rilis di atas, dan web root ke `be/public`.
Pastikan platform menyediakan filesystem persisten untuk `storage/`.

---

## 5. Jalur D — Apache (VPS)

```apache
<VirtualHost *:443>
    ServerName domain-anda
    DocumentRoot /var/www/sistem-peminjaman-barang/be/public

    <Directory /var/www/sistem-peminjaman-barang/be/public>
        AllowOverride All
        Require all granted
    </Directory>

    # SSLEngine on ... (sertifikat dari certbot)
</VirtualHost>
```

```bash
sudo a2enmod rewrite headers
sudo systemctl restart apache2
```

`.htaccess` bawaan `be/public` sudah meneruskan `Authorization` dan menangani trailing slash.
Pastikan `AllowOverride All` aktif, jika tidak rewrite Laravel diabaikan.

---

## 6. Verifikasi setelah deploy (smoke test)

```bash
curl -i https://domain-anda/up              # health Laravel -> 200
curl -i https://domain-anda/api/v1/health   # health API -> 200 JSON
curl -sI https://domain-anda/ | grep -i content-security-policy
```

Lalu di browser:

1. Buka `https://domain-anda/` — halaman login muncul (dengan widget Turnstile bila aktif).
2. Login sebagai administrator.
3. Pastikan gambar ruangan/barang tampil (uji penyajian berkas privat).
4. Unduh laporan XLSX dan PDF dari panel kelola.
5. Aktifkan mode maintenance, pastikan pengumuman muncul, lalu matikan kembali.

---

## 7. Troubleshooting

| Gejala | Penyebab umum |
| --- | --- |
| `503 Frontend belum dibangun` | `be/public/app/index.html` belum ada → jalankan `composer frontend:build` |
| `403 Origin tidak diizinkan` | `APP_URL`/`FRONTEND_URL` bukan origin HTTPS sebenarnya |
| Login gagal verifikasi captcha | `TURNSTILE_SITE_KEY`/`TURNSTILE_SECRET_KEY` salah, domain belum terdaftar, atau outbound diblokir |
| Aplikasi gagal boot: `Production hardening failed` | Baca pesannya: `APP_DEBUG`, `JWT_REFRESH_COOKIE_SECURE`, `MAIL_MAILER`, URL bukan `https://`, atau `DB_SSLMODE` kurang ketat |
| `JWT secret must contain at least 32 characters` | `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` kosong, terlalu pendek, masih placeholder, atau keduanya sama |
| `500` saat request API | Baca `be/storage/logs/laravel.log`; `APP_DEBUG` wajib `false` di produksi |
| Upload > 10 MB gagal `413` | `client_max_body_size`, `upload_max_filesize`, `post_max_size` belum dinaikkan |
| Perubahan `.env` tidak berpengaruh | Cache konfigurasi: jalankan `php artisan optimize:clear` lalu `php artisan optimize` |
| Gambar/dokumen `404` | Izin `storage/` salah atau berkas tidak ikut terunggah |

---

## 8. Redeploy & rollback

```bash
cd /var/www/sistem-peminjaman-barang
git pull

cd fe && npm ci && npm run build && cd ../be     # bila frontend berubah
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan optimize:clear && php artisan optimize
```

Rollback: `git checkout <tag-sebelumnya>`, ulangi langkah build, lalu jalankan
`php artisan migrate:rollback --step=N --force` **hanya** bila migrasi terakhir memang harus dibatalkan.

---

## 9. Backup & pemulihan

```bash
# Backup harian
pg_dump -Fc -h 127.0.0.1 -U peminjaman_app sistem_peminjaman > /backup/db-$(date +%F).dump

# Berkas unggahan (gambar & PDF)
tar -czf /backup/storage-$(date +%F).tar.gz /var/www/sistem-peminjaman-barang/be/storage/app
```

- Simpan cadangan **di luar** folder proyek dan di luar web root.
- Uji restore secara berkala: `pg_restore -d sistem_peminjaman <file>.dump`.
- Jangan pernah menaruh `.sql`/`.dump` di dalam repositori atau `public_html`.

---

## 10. Checklist keamanan deploy

- [ ] `APP_ENV=production`, `APP_DEBUG=false`
- [ ] `APP_URL` dan `FRONTEND_URL` = origin HTTPS sebenarnya
- [ ] `TRUSTED_PROXIES` = IP/rentang proxy nyata (**bukan `*`**)
- [ ] Web root = `be/public` (atau layout pada bagian 3.2)
- [ ] `php artisan key:generate` + `auth:generate-secrets` dijalankan sekali
- [ ] `JWT_REFRESH_COOKIE_SECURE=true`, `SESSION_SECURE_COOKIE=true`
- [ ] Turnstile aktif **dan** kedua key terisi (atau sengaja dimatikan)
- [ ] `DB_SSLMODE=require` (atau `verify-ca`/`verify-full`) untuk database remote
- [ ] `MAIL_MAILER` bukan `log` bila fitur reset password dipakai
- [ ] `migrate --force` sukses, `storage/` & `bootstrap/cache/` writable
- [ ] Cron `schedule:run` terpasang (wajib bila `BOOKING_ROOM_AUTO_CONFIRM_MINUTES` > 0)
- [ ] Tidak ada dump basis data / berkas `.env` di dalam web root
- [ ] `php artisan optimize` dijalankan setelah `.env` final
- [ ] Smoke test bagian 6 lolos
- [ ] Backup otomatis + uji restore terjadwal