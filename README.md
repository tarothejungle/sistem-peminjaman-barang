# Sistem Peminjaman Barang & Ruang Rapat

Satu Sistem Untuk Semua — platform peminjaman barang dan ruang rapat berbasis React + Laravel single-server.

> **Branding publik generik.** Ikon `Building2` (`lucide-react`) digunakan sebagai logo. Tidak ada aset `binwasnaker.*` di repo publik; aset tersebut tetap ada di disk lokal via `.gitignore` (`**/binwasnaker.*`, `docs/`).

## Tech Stack

- **Frontend:** React 19, TypeScript 6, Vite 8, Tailwind CSS 3, React Router 7, TanStack Query 5, Zustand 5, Axios, React Hook Form + Zod
- **Backend:** Laravel 13 (PHP 8.3), PostgreSQL 17, JWT (`firebase/php-jwt`), `laravel/pint`
- **Build target:** Vite `base: /app/` → `server-laravel/public/app` (single-server, `VITE_API_BASE_URL=/api/v1`, `http://localhost:8010`)
- **Tooling:** `oxlint`, `vite`, `phpunit` 12

## Roles

- `PEMOHON` → label `USER` — buat & kelola pengajuan milik sendiri, konfirmasi selesai
- `PJ_RUANGAN` → `PJ RUANGAN` — review `PENDING_PJ_REVIEW` → `PREPARING` → `PENDING_KABAG_APPROVAL`
- `KABAG_UMUM` → `KABAG UMUM` — approval `PENDING_KABAG_APPROVAL` → `APPROVED`, kelola master data + `Data Kabag`

Akun hanya dibuat KABAG (self-registration dihapus). `POST /auth/register` → 404.

## Fitur Utama

- **Dashboard realtime KABAG** — `GET /bookings/availability-summary` poll 3 detik, state `RESERVED | IN_USE | AWAITING_CONFIRMATION` (prioritas `IN_USE` > `AWAITING_CONFIRMATION` > `RESERVED`), `pending-count` badge `99+` poll 3 detik
- **Slot jam ruang** — `MORNING 08:00-12:00`, `AFTERNOON 13:00-16:00`, `FULL_DAY 08:00-16:00` (constraint `morning_end <= afternoon_start`), lintas hari wajib `FULL_DAY`, zona `Asia/Jakarta`
- **Workflow booking** — `PENDING_PJ_REVIEW → PREPARING → PENDING_KABAG_APPROVAL → APPROVED → COMPLETED` (user `PATCH /bookings/{id}/confirm-finished` setelah `end_time` lewat, body kosong, `lockForUpdate`), edit/hapus hanya `PENDING_PJ_REVIEW` milik sendiri
- **Gambar resource** — private `resource-images/rooms|items/` JPEG/PNG/WebP ≤ 5 MB, validasi byte `finfo`, nama UUID, endpoint `GET /rooms/{id}/image` & `GET /items/{id}/image` (`X-Content-Type-Options: nosniff`)
- **Dokumen lintas hari** — PDF ≤ 10 MB (`%PDF-` magic), storage `booking-documents/`, owner/PJ/KABAG only
- **Sidebar collapsible** — `256px ↔ 80px`, `localStorage sidebar-collapsed`, `BrandLogo Building2 h-9 w-9`
- **Notifikasi** — `SuccessToast` auto-dismiss 3 detik (`useRef` timer)

## Struktur Repo

```
client/                     # React app (Vite base /app/)
  src/components/common/    # BrandLogo (Building2), ResourceImage blob, SuccessToast
  src/components/layout/    # MainLayout — teks [nama project] / [deskripski project]
  src/features/{auth,admin,bookings,dashboard,rooms,items,users}
  src/routes/AppRoutes.tsx  # /login, /dashboard, /my-bookings, /admin/*
  src/lib/api.ts            # axios baseURL = VITE_API_BASE_URL
server-laravel/             # Laravel single-server (public/app = frontend build)
  app/{Enums,Models,Services,Http/{Controllers,Requests,Middleware}}
  routes/api.php            # /api/v1 prefix, jwt + role middleware
  database/migrations/      # 4 Ran: schema, documents, slots, images
  tests/Feature|Unit/       # 39 test, 197 assertion
```

Aktif: `server-laravel/` + `client/`. Legacy `server/` (Node/Express/Prisma) **telah dihapus** — tidak ada kaitan dengan build terbaru.

## Quick Start

```bash
# clone
git clone https://github.com/tarothejungle/sistem-peminjaman-barang.git
cd sistem-peminjaman-barang

# backend
cd server-laravel
copy .env.example .env   # atau cp
composer install
php artisan key:generate
php artisan migrate --seed
php artisan serve --host=127.0.0.1 --port=8010

# frontend (dev, di terminal lain)
cd ../client
npm install
npm run dev              # atau build untuk single-server
npm run build            # output → server-laravel/public/app

# akses
# http://localhost:8010/app/   (single-server)
# http://localhost:5173/       (vite dev)
```

Env penting `server-laravel/.env`:
`DB_CONNECTION=pgsql`, `DB_*`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ISSUER/AUDIENCE`, `SEED_DEFAULT_PASSWORD`, `VITE_API_BASE_URL=/api/v1`.

## API Ringkas

Base: `/api/v1` — JSON camelCase (`SerializesCamelCase`), error `ApiException`.

```
POST   /auth/login | /auth/refresh | /auth/logout
GET    /auth/me                 (jwt)
PATCH  /auth/password           (jwt)
GET    /health
GET    /rooms | /rooms/{id}/image | POST /rooms | POST|PUT /rooms/{id} | DELETE /rooms/{id}  (KABAG_UMUM)
GET    /items | /items/{id}/image | POST /items | POST|PUT /items/{id}                        (KABAG_UMUM)
GET    /room-booking-settings | PUT /room-booking-settings                                     (KABAG_UMUM)
GET    /room-managers | POST | PUT | DELETE   (KABAG_UMUM)
GET    /department-heads | POST | PUT | DELETE (KABAG_UMUM) — role dipatok KABAG_UMUM
GET    /users | POST | PUT | DELETE           (KABAG_UMUM)
POST   /bookings                               (PEMOHON, multipart: roomSlot, document PDF opsional)
POST|PUT /bookings/{id} | DELETE /bookings/{id}  (PEMOHON owner, hanya PENDING_PJ_REVIEW)
PATCH  /bookings/{id}/confirm-finished        (PEMOHON owner, APPROVED + end_time lewat)
GET    /bookings/availability                 (PEMOHON, KABAG_UMUM; exclude own pending via bookingId)
GET    /bookings/availability-summary         (PEMOHON, KABAG_UMUM) — tanpa borrower/purpose
GET    /bookings/pending-count                (PJ hitung PENDING_PJ_REVIEW+PREPARING, KABAG hitung PENDING_KABAG_APPROVAL)
GET    /bookings/my | GET /bookings | PATCH /bookings/{id}/{pj-review,kabag-approve,pj-confirm,pj-inspect,status}
GET    /bookings/{id}/document                (owner/PJ/KABAG, private PDF)
```

## Validasi & Keamanan

- JWT Bearer access + refresh cookie, `Middleware AuthenticateJwt`, `RequireRole`
- `StrictRequest` tolak `role` injection, `lockForUpdate` pada mutasi status, owner check → 404
- `ResourceImageService` validasi `finfo` byte + UUID path, `BookingService` cek overlap slot + stok

## Test & Lint

```bash
cd server-laravel
php artisan test                 # 39 passed, 197 assertions
vendor/bin/pint --test
cd ../client
npm run lint                     # oxlint
npm run build                    # tsc -b && vite build
```

## Catatan Repo

- `docs/` & `specs/` tidak dipush (ignored) — desain tetap di disk lokal
- `server-laravel/public/app/` ignored — deploy via `npm run build`
- Branch lokal: `main` (private, logo asli) ↔ `public` (push ke `origin/main`, sanitized branding)
