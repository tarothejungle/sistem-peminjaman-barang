# Sistem Peminjaman Ruang Rapat & Kendaraan

## Deskripsi Proyek

Sistem Peminjaman Ruang Rapat & Kendaraan adalah aplikasi web untuk mengelola peminjaman fasilitas kantor dalam satu tempat. Pengguna dapat melihat ketersediaan, mengajukan peminjaman, memantau proses persetujuan, dan melihat riwayat pengajuan. Pengelola dapat meninjau permintaan, mengatur data ruangan dan kendaraan, menangani pembatalan, serta membuat laporan.

Frontend dan backend berada dalam satu repositori. Saat dipakai di production, frontend dibangun ke dalam folder publik Laravel sehingga seluruh aplikasi dapat dijalankan dari satu server.

## Tech Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, Zustand, React Hook Form, dan Zod
- **Backend:** Laravel, PHP, JWT, Dompdf, dan PhpSpreadsheet
- **Database:** PostgreSQL
- **Testing dan tooling:** Vitest, Testing Library, PHPUnit, Laravel Pint, dan Oxlint

## Fitur

- Peminjaman ruang rapat berdasarkan tanggal dan slot waktu
- Peminjaman kendaraan beserta dokumen pendukung
- Alur pemeriksaan dan persetujuan sesuai peran pengguna
- Informasi ketersediaan ruang dan kendaraan
- Pengelolaan data ruangan, kendaraan, pengguna, dan pengaturan sistem
- Riwayat peminjaman, notifikasi, pembatalan, dan alternatif ruangan
- Laporan peminjaman dalam format PDF dan Excel
- Tampilan agenda ruang untuk Smart TV
- Profil pengguna, reset password, mode maintenance, serta pesan informasi

## Struktur Proyek

```text
.
├── fe/                 # Aplikasi React dan seluruh antarmuka pengguna
│   ├── src/
│   │   ├── components/ # Komponen umum dan layout
│   │   ├── features/   # Modul fitur aplikasi
│   │   ├── lib/        # API client dan helper
│   │   ├── routes/     # Konfigurasi halaman
│   │   └── store/      # State aplikasi
│   └── public/         # Aset statis
├── be/                 # API Laravel dan server aplikasi
│   ├── app/            # Controller, model, service, middleware, dan enum
│   ├── database/       # Migration, factory, dan seeder
│   ├── resources/      # Template email dan laporan
│   ├── routes/         # Route API dan web
│   └── tests/          # Test backend
└── docs/               # Dokumentasi teknis dan deployment
```

## Quick Start

Pastikan PHP 8.3, Composer, Node.js, npm, dan PostgreSQL sudah tersedia.

```bash
git clone https://github.com/tarothejungle/sistem-peminjaman-barang.git
cd sistem-peminjaman-barang
```

Siapkan backend:

```bash
cd be
cp .env.example .env
composer install
php artisan key:generate
php artisan auth:generate-secrets
```

Sesuaikan koneksi PostgreSQL pada `be/.env`, lalu jalankan:

```bash
php artisan migrate
php artisan admin:create-administrator
php artisan serve --host=127.0.0.1 --port=8010
```

Pada terminal lain, siapkan frontend:

Buat `fe/.env.local`:

```env
VITE_API_BASE_URL=http://localhost:8010/api/v1
```

Lalu jalankan:

```bash
cd fe
npm install
npm run dev
```

Frontend development tersedia di `http://localhost:5173`. Untuk menjalankan frontend dan backend dari satu server, buat build production lalu buka `http://localhost:8010/app/`:

```bash
cd fe
npm run build
```
