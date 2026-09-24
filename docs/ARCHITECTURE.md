# Architecture - Sistem Peminjaman Ruang Rapat & Kendaraan

Selaras dengan kode pada 2026-09-18. Bila dokumen ini bertabrakan dengan kode, kode yang menang.

## 1. Ringkasan

Aplikasi memakai model decoupled client-server dengan **deploy single-server**: React dibangun oleh Vite, lalu disajikan oleh Laravel dari origin yang sama.

- API: Laravel 13 (PHP 8.3) pada prefix `/api/v1`
- Frontend: hasil build `fe/` (Vite, `base: /app/`) ke `be/public/app`, diakses di `/app/`
- Database: PostgreSQL 17

Menyajikan keduanya dari satu origin adalah keputusan sadar: cookie refresh bisa memakai `SameSite=Strict` tanpa skema lintas situs, dan `RequireBrowserOrigin` cukup memvalidasi header `Origin` terhadap `APP_URL`/`FRONTEND_URL`.

## 2. Stack

| Lapisan | Teknologi |
| --- | --- |
| Frontend | React 19, TypeScript 6, Vite 8, Tailwind CSS 3, React Router 7, TanStack Query 5, Zustand 5, Axios, React Hook Form + Zod, shadcn/ui, lucide-react |
| Backend | Laravel 13, PHP 8.3, Eloquent, FormRequest, PHP Enum |
| Database | PostgreSQL 17, kolom waktu disimpan UTC |
| Auth | JWT `firebase/php-jwt` (access token) + cookie refresh + tabel `auth_sessions` |
| Ekspor | `phpoffice/phpspreadsheet` (xlsx), `dompdf/dompdf` (pdf) |
| Captcha | Cloudflare Turnstile, aktif otomatis saat `APP_ENV=production` |
| Test & lint | PHPUnit 12 + Laravel Pint (`be/`); Vitest + oxlint (`fe/`) |

Express, Prisma, dan Zod-di-backend tidak dipakai di repo ini.

## 3. Struktur Repo

```text
be/                                  # Laravel
  app/
    Casts/PostgresTextArray.php
    Console/Commands/                # CreateAdministratorCommand, GenerateJwtSecretsCommand
    Enums/                           # Role, BookingStatus, ResourceType, RoomBookingSlot
    Exceptions/ApiException.php
    Http/
      Controllers/
      Middleware/                    # AuthenticateJwt, RequireRole, RequireBrowserOrigin, SecurityHeaders, EnsureSiteIsAvailable
      Requests/                      # StrictRequest + turunannya
    Logging/RedactSensitiveData.php
    Models/
    Services/                        # seluruh logika bisnis
  bootstrap/app.php                  # routing, alias middleware, render exception terpusat
  config/{jwt,services,cors}.php
  database/migrations/
  routes/api.php
  tests/{Feature,Unit}/
fe/                                  # React
  src/components/{common,layout,ui}/ # ui/ = shadcn
  src/features/<fitur>/{api,components,pages}
  src/lib/                           # api (axios), authToken, queryClient, datetime, validation
  src/routes/AppRoutes.tsx
  src/store/                         # Zustand
  src/types/
  vite.config.ts                     # base: /app/, output ke ../be/public/app
```

## 4. Lapisan Backend

Alur satu request:

```text
Route (routes/api.php)
  -> middleware: EnsureSiteIsAvailable -> browser-origin -> jwt -> role
  -> FormRequest (StrictRequest)   validasi + whitelist field
  -> Controller                    memanggil service, membungkus response
  -> Service                       logika bisnis + transaksi
  -> Model / DB                    Eloquent, PostgreSQL
```

- **Controller** tidak memuat aturan bisnis. Ia menerima data tervalidasi, memanggil service, dan mengembalikan `{data: ...}`.
- **FormRequest** mewarisi `StrictRequest`: `allowedFields()` menolak field tak dikenal, `requireAtLeastOneField()` menolak update kosong, dan konstanta `ISO8601_DATETIME` memaksa timestamp menyertakan offset.
- **Service** memegang aturan bisnis dan membungkus operasi multi-tabel dengan `transaction()`.
- **Exception** domain dilempar sebagai `ApiException($message, $status, $details)` dan dirender terpusat di `bootstrap/app.php`.
- **Middleware** `jwt` mengisi `$request->attributes` dengan `auth_user_id`, `auth_role`, dan `auth_session_id`.
- **Middleware** `EnsureSiteIsAvailable` terpasang paling awal pada grup `api`; ia membaca satu baris `maintenance_settings` dan menutup request dengan `503` ketika situs dimatikan. `/health`, `/maintenance`, `/attention-messages/public`, `/auth/*`, dan token administrator dikecualikan.

## 5. Kontrak HTTP

- Sukses: `{data: ...}`
- Gagal: `{error: {message: ..., details: {...}}}`
- Status yang dipakai: 400 validasi gagal, 401 belum autentikasi, 403 role/origin tidak diizinkan, 404 data tidak ditemukan, 409 transisi status tidak sah, 422 kredensial/token tidak sesuai, 429 rate limit, 500 error tak terduga.

## 6. Alur Autentikasi

```text
POST /api/v1/auth/login   username + password (+ captchaToken bila Turnstile aktif)
  -> verifikasi Turnstile
  -> Hash::check terhadap password_hash; saat user tidak ada tetap dihitung dengan hash dummy
  -> AuthSessionService::create(): buat baris auth_sessions, access token, refresh token
  -> response data.accessToken + Set-Cookie refreshToken
     (HttpOnly, SameSite=Strict, Path=/api/v1/auth, Secure mengikuti JWT_REFRESH_COOKIE_SECURE)

Setiap request ber-middleware jwt:
  Authorization: Bearer <accessToken>
  -> decode JWT -> payload.sid
  -> AuthSessionService::authenticate(sid): periksa revoked_at, expires_at, dan batas tidak aktif
  -> isi auth_user_id / auth_role / auth_session_id

POST /api/v1/auth/refresh   (cookie refreshToken)
  -> rotasi token; bila hash tidak cocok, sesi langsung dicabut (deteksi replay)
POST /api/v1/auth/activity
  -> heartbeat; menulis last_activity_at paling sering setiap AUTH_ACTIVITY_WRITE_INTERVAL_SECONDS
POST /api/v1/auth/logout
  -> cabut sesi dan hapus cookie

POST /api/v1/auth/forgot-password        -> kirim tautan berisi token 64 hex
POST /api/v1/auth/reset-password/verify  -> cek validitas token
POST /api/v1/auth/reset-password         -> set password baru
PATCH /api/v1/auth/password              -> ganti password, mencabut seluruh sesi user
```

Access token **bukan** stateless murni: setiap request membaca satu baris `auth_sessions`. Itulah harga dari kemampuan mencabut sesi dan menegakkan batas tidak aktif.

## 7. Data Realtime

Dashboard memakai polling, bukan websocket. `GET /api/v1/bookings/availability-summary` dipanggil berkala untuk menghitung status ruangan `RESERVED`, `IN_USE`, atau `AWAITING_CONFIRMATION`, dengan prioritas `IN_USE` > `AWAITING_CONFIRMATION` > `RESERVED`.

### Penutupan otomatis peminjaman ruang

Peminjaman ruang berhenti di status `APPROVED` sampai pemohon menekan "Konfirmasi Selesai Menggunakan". Karena banyak pemohon lupa, perintah terjadwal `bookings:auto-confirm-rooms` (tiap menit, `routes/console.php`) menutup sendiri peminjaman ruang yang jam pemakaiannya sudah lewat lebih dari `BOOKING_ROOM_AUTO_CONFIRM_MINUTES`. Aturannya ada di `BookingService::autoConfirmExpiredRoomBookings()`:

- Hanya berlaku untuk `resource_type = ROOM`; peminjaman barang tetap menunggu konfirmasi dan inspeksi fisik.
- Batas waktunya dihitung dari jam selesai yang berlaku (`COALESCE(alternative_end_time, end_time)`), jadi peminjaman yang dipindah ruangan mengikuti jadwal barunya.
- `returned_at` diisi jam selesai pemakaian, bukan jam job berjalan, sehingga skor kredibilitas pemohon tidak dihitung sebagai pengembalian terlambat. `auto_confirmed_at` menandai bahwa sistem yang menutup, dan pemohon menerima notifikasi `BOOKING_AUTO_CONFIRMED`.
- Nilai `0` mematikan fitur ini sepenuhnya (perilaku lama). `--dry-run` menghitung calon tanpa mengubah data.

Opsi "Beri Alternatif Ruangan" pada Ruang Rapat Utama juga mengikuti masa peminjaman. Tombolnya hanya muncul selama rentang sesi berjalan (`alternativeStartTime ?? startTime` sampai `alternativeEndTime ?? endTime`) dan hilang begitu jadwal yang berlaku lewat; tabel admin men-`tick` waktu setiap 30 detik supaya tombolnya menutup sendiri tanpa reload. Pengajuan yang masih menunggu keputusan KASUBAG tetap bisa dialihkan sampai jadwalnya lewat, karena alternatif adalah bagian dari keputusan persetujuan itu sendiri. Server menegakkan batas akhir yang sama lewat `BookingService::relocateMainRoomBooking()`.

`GET /api/v1/maintenance` juga di-polling oleh frontend, supaya halaman yang sedang terbuka ikut menampilkan layar maintenance begitu saklar dinyalakan tanpa perlu memuat ulang aplikasi. Intervalnya menyesuaikan sisa waktu: 30 detik saat masih jauh, dan merapat sampai 5 detik ketika `estimatedEndAt` mendekat, sehingga layar maintenance hilang sendiri tepat setelah tenggat.

Sisi server juga menegakkan tenggat itu: `MaintenanceService::settings()` memeriksa `estimated_end_at`, dan begitu waktunya lewat ia mematikan `is_enabled` (update bersyarat `where is_enabled = true`) sebelum mengembalikan baris terbaru. Jadi situs kembali terbuka tanpa admin perlu mematikannya manual, dan respons `isEnabled` selalu mencerminkan status sebenarnya.

Modal informasi pasca-login tidak memakai polling: `GET /api/v1/attention-messages` diambil sekali setelah login berhasil, lalu ditampilkan sesuai `sortOrder`.

Pengumuman pra-login (`placement BEFORE_LOGIN`) dibaca halaman masuk lewat `GET /api/v1/attention-messages/public`; endpoint ini publik dan tetap terbuka saat maintenance.

## 8. Frontend

- **Routing:** `src/routes/AppRoutes.tsx`. Seluruh halaman di-`lazy` dan dibungkus `Suspense`, dengan `ProtectedRoute` berbasis role.
- **Data server:** TanStack Query. Tidak ada pengambilan data manual lewat `useEffect`.
- **State klien:** Zustand (`src/store/`), hanya untuk sesi dan UI. Data server tidak disimpan di store.
- **HTTP:** satu instance axios (`src/lib/api.ts`) dengan `withCredentials`, menyisipkan `Authorization` dari `src/lib/authToken.ts`. Respons 401 memicu event `auth:unauthorized` yang ditangani terpusat.
- **Build:** `npm run build` menjalankan `tsc -b && vite build`, hasilnya masuk ke `be/public/app`.
- **Mode maintenance:** `MaintenanceGate` membungkus seluruh `<Routes>` dan menggantikan aplikasi dengan `MaintenanceScreen` saat `isEnabled`. Halaman publik (`/login`, `/maintenance-login`, `/forgot-password`, `/reset-password`, `/session-expired`) dan administrator tetap dilewatkan, dan `SessionSplash` ditahan sampai probe sesi selesai supaya administrator tidak terkunci di luar. `MaintenanceScreen` menautkan ke `/maintenance-login`: halaman itu melewati pengalihan "sudah login" milik `/login`, sehingga sisa sesi peminjam tidak lagi memantulkan administrator ke `/dashboard`.
- **Informasi pasca-login:** `AttentionDialog` dibuka dari `MainLayout`/`KabagNotchLayout` ketika `pendingLoginNotice` di `authStore` bernilai `true` (di-set `setAuth`, dibersihkan setelah dibaca). Penanda ini sengaja tidak memakai `location.state`, karena pengalihan tambahan saat login dapat menghapus state router sebelum layout sempat membacanya.

## 9. Testing

- **Unit** (`be/tests/Unit`): logika murni, misalnya daftar status overlap dan `JwtService`.
- **Feature** (`be/tests/Feature`): menguji endpoint lewat HTTP. Setiap test **membangun skema SQLite sendiri** dengan `Schema::create()` di `setUp()`, bukan menjalankan migrasi. Middleware `AuthenticateJwt` punya jalur pintas `sid === 'test-session'` saat `APP_ENV=testing`.
- **Frontend**: Vitest + Testing Library, file `*.test.ts`/`*.test.tsx` di samping kodenya.

Konsekuensi: skema test bisa menyimpang dari migrasi PostgreSQL. Saat mengubah skema, perbarui migrasi **dan** skema ad-hoc pada test terkait.

## 10. Urutan Sumber Kebenaran

1. Kode: `be/routes/api.php`, `be/app/Enums/`, `be/bootstrap/app.php`, `be/database/migrations/`
2. `README.md` dan `DEPLOYMENT.md`
3. Dokumen di `docs/`

Rancangan lama berbasis Node.js + Express + Prisma tidak pernah dipakai dan tidak boleh dijadikan acuan.
