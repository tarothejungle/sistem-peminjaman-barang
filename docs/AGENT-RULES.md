# AI Agent Rules & Workflow Constraints

Aturan kerja agent AI untuk repo **Sistem Peminjaman Ruang Rapat & Kendaraan**.

> Dokumen ini menggambarkan stack yang **benar-benar ada di repo ini**. `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/API-SPEC.md`, dan `docs/SECURITY.md` sudah diselaraskan dengan kode pada 2026-09-18.

## 1. Execution Principles

- **One Feature at a Time:** dilarang men-generate seluruh aplikasi dalam satu perintah. Kerjakan per tahap (mis. migrasi + model -> service -> endpoint -> UI).
- **Read Before Write:** baca `README.md`, `DEPLOYMENT.md`, dan modul terkait sebelum mengubah kode.
- **Do Not Guess the Contract:** dilarang mengarang nama kolom, endpoint, role, atau status baru. Sumber kebenaran: `be/database/migrations/` untuk schema, `be/routes/api.php` untuk endpoint, `be/app/Enums/` untuk role dan status.
- **Graph First:** setiap permintaan dimulai dengan preflight `codebase-memory` untuk project ini (cek indeks, lalu telusuri graf) sebelum membaca atau mengubah kode. Perintah, urutan tool, dan fallback CLI saat MCP mati ada di `AGENTS.md` bagian 0.
- **Minimal Diff:** ikuti pola di sekitar kode yang diubah; jangan me-refactor hal yang tidak diminta.

## 2. Stack Aktual

| Lapisan | Teknologi |
| --- | --- |
| Frontend (`fe/`) | React 19, TypeScript 6, Vite 8, Tailwind CSS 3, React Router 7, TanStack Query 5, Zustand 5, Axios, React Hook Form + Zod, shadcn/ui, lucide-react |
| Backend (`be/`) | Laravel 13, PHP 8.3, PostgreSQL 17, JWT `firebase/php-jwt`, `dompdf`, `phpoffice/phpspreadsheet` |
| Test & lint | PHPUnit 12 + Laravel Pint (`be/`), Vitest + oxlint (`fe/`) |
| Model deploy | Single-server: Laravel menyajikan API `/api/v1` dan hasil build `fe/` di `/app/` (`vite base: /app/` -> `be/public/app`) |

Express, Prisma, dan Zod **tidak dipakai di backend**. Jangan menambahkan `helmet`, `cors`, `asyncHandler`, atau middleware bergaya Express.

## 3. Struktur Repo

```text
fe/                                  # React app
  src/components/{common,layout,ui}/ # komponen bersama; ui/ = shadcn
  src/features/<fitur>/              # {api,components,pages} per fitur
  src/lib/                           # api (axios), authToken, queryClient, datetime
  src/routes/AppRoutes.tsx
  src/store/                         # Zustand
be/                                  # Laravel
  app/{Enums,Models,Services,Casts,Exceptions}
  app/Http/{Controllers,Requests,Middleware}
  app/Console/Commands/              # CreateAdministratorCommand, GenerateJwtSecretsCommand
  routes/api.php                     # prefix /api/v1
  database/migrations/
  tests/{Feature,Unit}/
```

## 4. Coding Guidelines - Backend (`be/`)

### Layer Separation

- **Controller** (`app/Http/Controllers/`): tipis. Terima `FormRequest` yang sudah tervalidasi, panggil Service, kembalikan `response()->json(['data' => ...])`. Boleh memuat pemeriksaan bentuk request yang murah, tapi aturan bisnis tidak boleh di sini.
- **Request** (`app/Http/Requests/`): semua validasi input. Wajib extends `StrictRequest`, yang menolak field tak dikenal lewat `allowedFields()` dan menolak update kosong lewat `requireAtLeastOneField()`. Dilarang memvalidasi manual dengan `$request->validate()` untuk payload baru.
- **Service** (`app/Services/`): seluruh logika bisnis (cek bentrok jadwal, kuota stok, transisi status, perhitungan kredit). Operasi multi-tabel wajib dibungkus `transaction()`.
- **Model** (`app/Models/`): Eloquent. Gunakan `Concerns/HasUuid` dan `Concerns/SerializesCamelCase` agar response konsisten camelCase.
- **Enum** (`app/Enums/`): `Role`, `BookingStatus`, `ResourceType`, `RoomBookingSlot`. Dilarang menulis role/status sebagai string literal di controller, service, atau query.
- **Exception**: lempar `ApiException($message, $status, $details)` untuk error domain; `bootstrap/app.php` sudah merendernya menjadi response JSON.

### Kontrak Response

- Sukses: `{data: ...}`
- Gagal: `{error: {message: ..., details: {...}}}`
- Validasi gagal -> HTTP **400** (bukan 422). Jangan mengubah perilaku ini tanpa alasan kuat.

### Autentikasi & Otorisasi

- Middleware alias: `jwt`, `role`, `browser-origin`. `SecurityHeaders` terpasang global.
- `jwt` mengisi `$request->attributes` dengan `auth_user_id` dan `auth_role` - pakai itu, jangan decode token ulang di controller.
- Role: `PEMOHON`, `PJ_RUANGAN`, `KABAG_UMUM`, `KASUBAG_UMUM`. Administrator = `KABAG_UMUM` + `KASUBAG_UMUM`; approver = `KASUBAG_UMUM` saja, karena `KABAG_UMUM` bersifat monitoring.
- `RequireBrowserOrigin` memvalidasi header `Origin` terhadap `APP_URL`/`FRONTEND_URL`. Jangan melonggarkan middleware ini untuk mempercepat debugging.

### Waktu & Berkas

- Timestamp ISO-8601 wajib menyertakan offset (`Z` atau `+hh:mm`); server tidak boleh menebak zona klien. Zona slot ruang adalah `Asia/Jakarta`, kolom DB disimpan `UTC`.
- Upload gambar: jpg/png/webp, maks 5 MB. Dokumen peminjaman: PDF, maks 10 MB. Selalu validasi `mimes` **dan** `mimetypes`.
- Berkas privat disimpan lewat `Storage::disk('local')` dan disajikan melalui endpoint ber-otorisasi, bukan URL publik.

## 5. Coding Guidelines - Frontend (`fe/`)

- **Data Fetching:** semua interaksi server lewat TanStack Query (`useQuery`/`useMutation`). Dilarang fetch dengan `useEffect` murni.
- **HTTP Client:** gunakan instance axios di `src/lib/api.ts` (`VITE_API_BASE_URL`, `withCredentials`). Dilarang memanggil `fetch` langsung ke API.
- **Token:** access token diambil lewat `src/lib/authToken.ts`. Respons 401 memicu event `auth:unauthorized` - jangan menangani redirect login sendiri per komponen.
- **Form:** React Hook Form + resolver Zod.
- **State klien:** Zustand (`src/store/`). Jangan menyimpan data server di store.
- **Struktur fitur:** taruh kode pada `src/features/<fitur>/` (`api/`, `components/`, `pages/`), bukan di folder global.
- **UI:** komponen shadcn/ui di `src/components/ui/`, alias import `@/`. Pertahankan pola `cn()` dari `tailwind-merge` + `clsx`.
- **Type Safety:** dilarang `any`. Setiap komponen dan API hook wajib punya tipe eksplisit.

## 6. Database Migration Workflow

- Skema aktif: PostgreSQL. Test berjalan di SQLite in-memory (`phpunit.xml`), jadi hindari SQL spesifik PostgreSQL tanpa fallback.
- Buat migrasi baru dengan `php artisan make:migration`, lalu jalankan `php artisan migrate`.
- Jangan mengubah migrasi yang sudah pernah di-deploy; buat migrasi baru untuk koreksi.
- Perubahan tipe kolom JSON/array harus lewat cast yang ada (mis. `App\Casts\PostgresTextArray`), bukan `json_decode` manual.

## 7. Perintah Verifikasi

```bash
cd be
php artisan test                 # PHPUnit
vendor/bin/pint --test           # format check

cd ../fe
npm run lint                     # oxlint
npm test                         # vitest
npm run build                    # tsc -b && vite build
```

Jalankan paling tidak test backend dan lint frontend untuk setiap perubahan.
