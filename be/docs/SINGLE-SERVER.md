# Panduan Single-Server Laravel + React

## Cara Kerja

React tetap dikembangkan di folder `client/`, lalu Vite membangun file statis ke `server-laravel/public/app/`. Laravel melayani file React untuk route browser, sedangkan `/api/v1/*` tetap diproses controller API Laravel.

```text
http://localhost:8010/             React
http://localhost:8010/dashboard    React Router
http://localhost:8010/my-bookings React Router
http://localhost:8010/api/v1/*     Laravel API
```

Frontend memakai URL API relatif:

```env
VITE_API_BASE_URL=/api/v1
```

Frontend dan API memakai origin sama. CORS tidak diperlukan untuk mode single-server dan refresh cookie mengikuti host Laravel.

## Instalasi Pertama

Dari folder `server-laravel`:

```powershell
composer install
composer frontend:install
composer frontend:build
```

Pastikan `.env` Laravel mengarah ke database yang benar:

```env
DB_CONNECTION=pgsql
DB_DATABASE=sistem_peminjaman
```

Bangun atau sinkronkan baseline schema:

```powershell
php artisan migrate
```

Migration bersifat idempotent: database kosong akan dibuat lengkap, sedangkan schema existing akan dicatat sebagai baseline tanpa membuat ulang tabel.

Untuk membuat akun development, tentukan password hanya pada proses command:

```powershell
$env:SEED_DEFAULT_PASSWORD="password-development-anda"
php artisan db:seed
Remove-Item Env:SEED_DEFAULT_PASSWORD
```

## Menjalankan Aplikasi

Dari folder `server-laravel`:

```powershell
php artisan serve --host=127.0.0.1 --port=8010
```

Buka:

```text
http://localhost:8010
```

Port `8010` dipakai karena port `8000` pada komputer ini sudah dipakai proyek Laragon lain.

## Workflow Harian

Perubahan backend Laravel langsung terbaca saat browser direfresh. Tidak perlu build ulang React.

Jika mengubah file React di `client/src/`, jalankan dari `server-laravel`:

```powershell
composer frontend:build
```

Kemudian refresh browser. `artisan serve` tetap berjalan.

```text
Ubah PHP     -> refresh browser
Ubah React   -> composer frontend:build -> refresh browser
```

## Akun Development

Seeder lokal menyediakan tiga akun:

```text
pemohon@example.test
pj.ruangan@example.test
kabag.umum@example.test
```

Gunakan password yang diberikan melalui `SEED_DEFAULT_PASSWORD` saat menjalankan seeder. Menu `Password` tersedia di bagian bawah sidebar, berdampingan dengan `Keluar`. Logout selalu meminta konfirmasi terlebih dahulu.

## Command Penting

```powershell
# Install dependency React
composer frontend:install

# Typecheck dan build React ke public/app
composer frontend:build

# Jalankan aplikasi single-server
php artisan serve --host=127.0.0.1 --port=8010

# Lihat route API
php artisan route:list --path=api/v1

# Jalankan test Laravel
php artisan test

# Periksa status migration
php artisan migrate:status

# Periksa format PHP
vendor\bin\pint --test
```

## Output Build

Vite menghasilkan:

```text
server-laravel/public/app/index.html
server-laravel/public/app/assets/*.js
server-laravel/public/app/assets/*.css
```

Folder `public/app/` adalah hasil build dan tercantum di `.gitignore`. Jangan edit file di folder tersebut secara manual karena akan ditimpa build berikutnya.

## SPA Fallback

Laravel mengembalikan `public/app/index.html` untuk semua route non-API. URL berikut aman dibuka langsung atau direfresh:

```text
/login
/dashboard
/my-bookings
/admin/approvals
/admin/rooms
/admin/items
```

Route `/api/*` dikecualikan dari fallback. API yang tidak ditemukan tetap menghasilkan JSON `404`, bukan halaman React.

## Error Umum

### Database tidak terlihat di HeidiSQL

Pastikan koneksi memakai PostgreSQL, bukan MySQL:

```text
Network type: PostgreSQL (TCP/IP)
Hostname: 127.0.0.1
Port: 5432
User: postgres
Database: sistem_peminjaman
```

Jika PostgreSQL Laragon belum aktif, jalankan melalui Laragon atau:

```powershell
& "D:\laragon\bin\postgresql\postgresql-18.4-2\bin\pg_ctl.exe" start -D "D:\laragon\data\postgresql-18"
```

Jika database belum ada:

```powershell
& "D:\laragon\bin\postgresql\postgresql-18.4-2\bin\createdb.exe" --host=127.0.0.1 --port=5432 --username=postgres sistem_peminjaman
php artisan migrate
```

### Frontend belum dibangun

Jika root menghasilkan HTTP `503` dengan pesan frontend belum dibangun:

```powershell
composer frontend:build
```

### Perubahan React tidak muncul

React single-server memakai hasil build, bukan source langsung:

```powershell
composer frontend:build
```

Lalu hard refresh browser dengan `Ctrl+F5`.

### Port sudah dipakai

Gunakan port lain:

```powershell
php artisan serve --host=127.0.0.1 --port=8011
```

Karena API memakai `/api/v1`, frontend otomatis mengikuti port baru tanpa perubahan `.env` atau rebuild.

### API masih menuju Node

Pastikan `client/.env` berisi:

```env
VITE_API_BASE_URL=/api/v1
```

Lalu build ulang frontend.

## Mode Vite Opsional

Jika nanti membutuhkan hot reload, Vite masih dapat dijalankan terpisah:

```powershell
cd ..\client
npm run dev
```

Mode utama proyek tetap single-server melalui hasil build React dan `php artisan serve`.
