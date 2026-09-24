# REST API Specification

Base URL: `/api/v1` (ditetapkan oleh `apiPrefix` di `bootstrap/app.php`). Sumber kebenaran rute adalah `be/routes/api.php`.

## 1. Konvensi

- JSON camelCase (model memakai trait `SerializesCamelCase`).
- Sukses: `{"data": ...}`. Gagal: `{"error": {"message": "...", "details": {...}}}`.
- Otentikasi: header `Authorization: Bearer <accessToken>`.
- Validasi gagal mengembalikan **400**, bukan 422. `422` dipakai untuk kredensial atau token yang tidak sesuai.
- Semua `FormRequest` mewarisi `StrictRequest`: field di luar whitelist ditolak, dan update tanpa field apa pun juga ditolak.
- Timestamp ISO-8601 wajib menyertakan offset (`Z` atau `+hh:mm`).
- Saat mode maintenance aktif, request `api/*` di luar `/health`, `/maintenance`, `/attention-messages/public`, dan `/auth/*` dijawab `503` dengan `error.details.code = "MAINTENANCE"` (lihat bagian 12).
- Form peminjaman dikirim sebagai `multipart/form-data` karena membawa berkas PDF.

Ringkasan role:

- `PEMOHON` - membuat dan mengelola pengajuan sendiri.
- `PJ_RUANGAN` - memeriksa pengajuan, mengelola master data ruang/barang.
- `KABAG_UMUM` - administrator, tetapi pada antrean approval hanya memantau.
- `KASUBAG_UMUM` - administrator pemegang mandat approval.

## 2. Health

| Method | Path | Akses | Catatan |
| --- | --- | --- | --- |
| GET | `/health` | publik | Menjalankan `SELECT 1`. `503` bila database tidak terhubung. |

Laravel juga menyediakan `GET /up` dari konfigurasi `withRouting(health: '/up')`.

## 3. Autentikasi (`/auth`)

| Method | Path | Akses | Throttle |
| --- | --- | --- | --- |
| GET | `/auth/config` | publik | - |
| POST | `/auth/login` | publik + `browser-origin` | `auth-login` |
| POST | `/auth/refresh` | publik + `browser-origin` (cookie) | `auth-refresh` |
| POST | `/auth/logout` | publik + `browser-origin` (cookie) | - |
| POST | `/auth/forgot-password` | publik | `auth-forgot-password` |
| POST | `/auth/reset-password/verify` | publik | `auth-reset-password` |
| POST | `/auth/reset-password` | publik | `auth-reset-password` |
| POST | `/auth/activity` | `jwt` | - |
| GET | `/auth/me` | `jwt` | - |
| PATCH | `/auth/password` | `jwt` | `auth-password` |

**GET /auth/config** - response `data.turnstileEnabled` dan `data.turnstileSiteKey` (key hanya dikirim bila Turnstile aktif).

**POST /auth/login**

```json
{ "username": "budi", "password": "rahasia12345", "captchaToken": "opsional" }
```

`captchaToken` wajib bila Turnstile aktif. Username hanya boleh `A-Za-z0-9._-` (maks 50), password maks 72 byte. Response:

```json
{ "data": { "accessToken": "...", "inactivityTimeoutSeconds": 1800, "activityHeartbeatSeconds": 60 } }
```

Plus `Set-Cookie: refreshToken` dengan `HttpOnly`, `SameSite=Strict`, `Path=/api/v1/auth`, dan `Secure` mengikuti `JWT_REFRESH_COOKIE_SECURE`. Kredensial salah menghasilkan `401` dengan pesan generik.

**POST /auth/refresh** - memakai cookie, bukan body. Merotasi refresh token; bila token tidak cocok dengan hash sesi, sesi dicabut dan response `401`.

**POST /auth/logout** - mencabut sesi dan menghapus cookie. Response `204`.

**POST /auth/forgot-password** - body `{ "email": "..." }`. Response selalu sama, ada atau tidak adanya akun, agar tidak bisa dipakai menyisir daftar email.

**POST /auth/reset-password/verify** - body `{ "token": "<64 hex>" }`, response `data.valid`.

**POST /auth/reset-password** - body `{ "token": "<64 hex>", "password": "...", "password_confirmation": "..." }`. Password minimal 12 karakter.

**POST /auth/activity** - heartbeat sesi, response `data.accessToken` yang baru.

**GET /auth/me** - profil pengguna yang sedang login. Field `creditScore` hanya dikirim untuk role `PEMOHON`; role lain tidak menerimanya sama sekali, begitu juga pada payload `/users` dan `/room-managers`.

**PATCH /auth/password** - body `currentPassword`, `newPassword`, `newPassword_confirmation`. Password baru minimal 12 karakter dan wajib berbeda dari yang lama. Seluruh sesi pengguna dicabut setelah berhasil.

## 4. Profil (`/profile`)

Dapat diakses semua role yang terautentikasi.

| Method | Path | Body | Catatan |
| --- | --- | --- | --- |
| PATCH | `/profile` | `fullName?`, `email?`, `phoneNumber` | |
| POST | `/profile/photo` | multipart `image` | jpg/jpeg/png/webp, maks 2 MB |
| GET | `/profile/photo` | - | mengembalikan berkas privat |
| DELETE | `/profile/photo` | - | |

## 5. Master Data

| Method | Path | Akses |
| --- | --- | --- |
| GET | `/rooms` | `jwt` |
| GET | `/rooms/{id}/image` | `jwt` |
| POST | `/rooms` | `KABAG_UMUM`, `KASUBAG_UMUM`, `PJ_RUANGAN` |
| POST, PUT | `/rooms/{id}` | `KABAG_UMUM`, `KASUBAG_UMUM`, `PJ_RUANGAN` |
| DELETE | `/rooms/{id}` | `KABAG_UMUM`, `KASUBAG_UMUM`, `PJ_RUANGAN` |
| GET | `/items` | `jwt` |
| GET | `/items/{id}/image` | `jwt` |
| POST | `/items` | `KABAG_UMUM`, `KASUBAG_UMUM`, `PJ_RUANGAN` |
| POST, PUT | `/items/{id}` | `KABAG_UMUM`, `KASUBAG_UMUM`, `PJ_RUANGAN` |

Body ruangan: `name`, `capacity`, `location`, `facilities` (array string), `image` (opsional, jpg/jpeg/png/webp maks 5 MB).

Body barang: `name`, `totalStock`, `category`, `plateNumber` (opsional, boleh dikosongkan untuk menghapus), `image` (opsional).

`POST` dan `PUT` pada `/{id}` sengaja keduanya diterima. Berkas gambar disimpan privat dan hanya disajikan lewat endpoint `/{id}/image`.

## 6. Pengaturan Peminjaman Ruang

| Method | Path | Akses |
| --- | --- | --- |
| GET | `/room-booking-settings` | `jwt` |
| PUT | `/room-booking-settings` | `KABAG_UMUM`, `KASUBAG_UMUM` |

Body: `morningStartTime`, `morningEndTime`, `afternoonStartTime`, `afternoonEndTime`, `fullDayStartTime`, `fullDayEndTime` dengan format `H:i`. `fullDayStartTime` wajib sama dengan `morningStartTime`, dan `fullDayEndTime` wajib sama dengan `afternoonEndTime`.

## 7. Manajemen Pengguna

Seluruh endpoint di bawah ini hanya untuk `KABAG_UMUM` dan `KASUBAG_UMUM`.

| Method | Path |
| --- | --- |
| GET, POST | `/room-managers` |
| PUT, DELETE | `/room-managers/{id}` |
| GET, POST | `/department-heads` |
| PUT, DELETE | `/department-heads/{id}` |
| GET, POST | `/users` |
| PUT, DELETE | `/users/{id}` |

Body: `fullName`, `username` (3-50 karakter, `A-Za-z0-9._-`), `email`, `password` (min 12 karakter). Field `role` **hanya** diterima pada endpoint `department-heads`, dan nilainya dibatasi ke `KABAG_UMUM` atau `KASUBAG_UMUM`. Endpoint lain menurunkan role dari rute sehingga tidak bisa dieskalasi lewat payload.

## 8. Notifikasi

| Method | Path | Akses |
| --- | --- | --- |
| GET | `/notifications` | `jwt` |
| PATCH | `/notifications/read-all` | `jwt` |
| PATCH | `/notifications/{id}/read` | `jwt` |

## 9. Aktivitas Login

| Method | Path | Akses |
| --- | --- | --- |
| GET | `/login-activities` | `KABAG_UMUM`, `KASUBAG_UMUM` |

## 10. Laporan

| Method | Path | Akses |
| --- | --- | --- |
| GET | `/reports/bookings/{format}` | `KABAG_UMUM`, `KASUBAG_UMUM`, `PJ_RUANGAN` |

`format` hanya `xlsx` atau `pdf`. Query opsional: `status` (nilai `BookingStatus`), `from` dan `to` (`Y-m-d`, dengan `to >= from`). Parameter query di luar itu ditolak dengan `400`. Response berupa berkas unduhan dengan `Content-Disposition: attachment` dan `X-Content-Type-Options: nosniff`.

## 11. Peminjaman (`/bookings`)

| Method | Path | Akses | Throttle |
| --- | --- | --- | --- |
| GET | `/bookings/availability` | `PEMOHON` | - |
| GET | `/bookings/availability-summary` | `PEMOHON`, `KABAG_UMUM`, `KASUBAG_UMUM` | - |
| POST | `/bookings` | `PEMOHON` | `booking-create` |
| POST, PUT | `/bookings/{id}` | `PEMOHON` | - |
| DELETE | `/bookings/{id}` | `PEMOHON` | - |
| PATCH | `/bookings/{id}/confirm-finished` | `PEMOHON` | - |
| GET | `/bookings/my` | `jwt` | - |
| GET | `/bookings/{id}/document` | `jwt` (owner, PJ, atau administrator) | - |
| GET | `/bookings/{id}/surat-tugas` | `jwt` (owner, PJ, atau administrator) | - |
| GET | `/bookings` | `PJ_RUANGAN`, `KABAG_UMUM`, `KASUBAG_UMUM` | - |
| PATCH | `/bookings/{id}/pj-review` | `PJ_RUANGAN` | - |
| PATCH | `/bookings/{id}/pj-confirm` | `PJ_RUANGAN` | - |
| PATCH | `/bookings/{id}/pj-inspect` | `PJ_RUANGAN` | - |
| PATCH | `/bookings/{id}/kabag-approve` | `KASUBAG_UMUM` | - |
| PATCH | `/bookings/{id}/alternative` | `KASUBAG_UMUM` | - |

### Membuat pengajuan (multipart)

Peminjaman **ruang**:

```json
{
  "resourceType": "ROOM",
  "roomId": "<uuid>",
  "startDate": "2026-09-20",
  "endDate": "2026-09-20",
  "roomSlot": "MORNING",
  "workUnit": "Bagian Umum",
  "responsibleName": "Budi",
  "phoneNumber": "08123456789",
  "purpose": "Rapat koordinasi",
  "document": "berkas PDF, opsional kecuali lintas hari"
}
```

`roomSlot` bernilai `MORNING`, `AFTERNOON`, atau `FULL_DAY`. Rentang lintas hari wajib memakai `FULL_DAY` dan **wajib** melampirkan `document` (PDF maks 10 MB). Field `suratTugas` tidak berlaku untuk peminjaman ruang dan ditolak bila dikirim.

Peminjaman **barang**:

```json
{
  "resourceType": "ITEM",
  "items": [{ "itemId": "<uuid>", "quantity": 2 }],
  "startTime": "2026-09-20T01:00:00Z",
  "endTime": "2026-09-21T01:00:00Z",
  "responsibleName": "Budi",
  "phoneNumber": "08123456789",
  "purpose": "Kegiatan lapangan",
  "suratTugas": "berkas PDF, wajib bila barang yang dipinjam punya nomor polisi"
}
```

`workUnit` dan `document` tidak berlaku untuk peminjaman barang; mengirimkannya akan ditolak. Sebaliknya `suratTugas` **wajib** bila salah satu barang yang dipinjam punya `plateNumber` (kendaraan) dan opsional untuk barang lain. Berkas disimpan privat dan hanya bisa diunduh pemilik, PJ, atau administrator lewat `/bookings/{id}/surat-tugas`.

### Mengubah dan menghapus

`POST|PUT /bookings/{id}` dan `DELETE /bookings/{id}` hanya berlaku untuk pengajuan **milik sendiri** yang masih berstatus `PENDING_PJ_REVIEW`. Status lain menghasilkan `409`. Pada update, PDF lama boleh dipertahankan tanpa unggah ulang. Karena form peminjaman barang juga membawa berkas, `POST|PUT` keduanya menerima `multipart/form-data` — bukan JSON. `DELETE` tetap tanpa body.

### Transisi status

Transisi divalidasi di service terhadap status asal. Status yang tidak sesuai menghasilkan `409` dengan pesan `Status peminjaman tidak sesuai dengan tahap proses`.

| Endpoint | Dari | Ke | Field |
| --- | --- | --- | --- |
| `pj-review` | `PENDING_PJ_REVIEW` | `PREPARING` (default) atau `REJECTED` | `status?`, `approvalNotes?`, `rejectionReason` (wajib bila `REJECTED`) |
| `pj-confirm` | `PREPARING` | `PENDING_KABAG_APPROVAL` | `status?`, `approvalNotes?` |
| `kabag-approve` | `PENDING_KABAG_APPROVAL` | `APPROVED` atau `REJECTED` | `status`, `approvalNotes?`, `rejectionReason` (wajib bila `REJECTED`) |
| `alternative` | `PENDING_KABAG_APPROVAL` atau `APPROVED` | `APPROVED` | `alternativeRoomId`, lalu `alternativeDate` + `alternativeRoomSlot` atau `alternativeStartTime` + `alternativeEndTime` |
| `pj-inspect` | `FINISHED_PENDING_INSPECTION` | `COMPLETED` | `status?`, `inspectionNotes?` |
| `confirm-finished` | `APPROVED` atau `IN_USE` | `COMPLETED` | tidak boleh ada body |

Peminjaman ruang yang tidak dikonfirmasi pemohon ditutup otomatis oleh perintah terjadwal `bookings:auto-confirm-rooms` setelah `BOOKING_ROOM_AUTO_CONFIRM_MINUTES` menit dari jam selesai pemakaian. Peminjaman seperti itu tetap berstatus `COMPLETED` dengan `returnedAt` = jam selesai sesuai jadwal dan `autoConfirmedAt` terisi sebagai penanda bahwa sistem yang menutup, bukan pemohon. Peminjaman barang tidak termasuk: pemakaiannya tetap harus ditutup oleh pemohon.

`confirm-finished` hanya boleh dipanggil pemohon, dan ditolak bila waktu mulai belum terlewat. Saat berhasil, `returned_at` diisi dan skor kredibilitas pemohon diperbarui paling banyak sekali per peminjaman. Skor hanya bergerak untuk akun `PEMOHON`, nilainya dibatasi 0 sampai 100, dan tidak pernah dihitung dua kali untuk peminjaman yang sama (ledger `user_credit_events` unik per `booking_id`).

Menetapkan `APPROVED` memicu pengecekan ulang ketersediaan jadwal.

`alternative` hanya berlaku untuk Ruang Rapat Utama dan hanya selama masa peminjaman berjalan. Bila jam selesai yang berlaku (`alternativeEndTime` bila pernah dialihkan, selain itu `endTime`) sudah lewat, endpoint mengembalikan `409` dengan pesan `Masa peminjaman sudah berakhir sehingga alternatif ruangan tidak dapat diberikan`. Tujuannya sama dengan penutupan otomatis peminjaman ruang: peminjaman yang jadwalnya sudah lewat tidak lagi bisa dialihkan.

### Ketersediaan

`GET /bookings/availability` menerima `resourceType` beserta field terkait: `roomId`, `startDate`, `endDate`, `roomSlot` untuk ruang; `itemId`, `quantity`, `startTime`, `endTime` untuk barang. Field milik tipe lain ditolak, bukan diabaikan. `bookingId` opsional dipakai untuk mengecualikan pengajuan sendiri saat memeriksa ulang.

`GET /bookings/availability-summary` mengembalikan status tiap ruang yang sedang terpakai: `RESERVED`, `IN_USE`, atau `AWAITING_CONFIRMATION`, dengan prioritas `IN_USE` > `AWAITING_CONFIRMATION` > `RESERVED`. Bila sebuah peminjaman punya ruang alternatif, yang dipakai adalah jadwal alternatifnya.

`GET /bookings/my` mengembalikan pengajuan milik pengguna yang sedang login. `GET /bookings` menerima query opsional `status`; parameter lain ditolak dengan `400`.

## 12. Mode Maintenance (`/maintenance`)

Saklar tunggal yang menutup seluruh situs ketika dinyalakan.

| Method | Path | Akses | Catatan |
| --- | --- | --- | --- |
| GET | `/maintenance` | publik | `isEnabled`, `message`, `estimatedEndAt`, `updatedAt` |
| PUT | `/maintenance` | `KABAG_UMUM`, `KASUBAG_UMUM` | body `isEnabled`, `message?`, `estimatedEndAt` (wajib & harus waktu mendatang saat `isEnabled = true`) |

Selama `isEnabled` bernilai `true`, middleware `EnsureSiteIsAvailable` menolak request `api/*` dengan `503`:

```json
{ "error": { "message": "Website sedang dalam perbaikan terjadwal...", "details": { "code": "MAINTENANCE", "estimatedEndAt": "2026-09-18T10:00:00+07:00" } } }
```

Yang tetap boleh lewat: `/health`, `/maintenance`, `/attention-messages/public`, seluruh `/auth/*`, dan request yang membawa access token administrator. Dengan begitu orang yang menyalakan maintenance masih bisa login dan mematikannya kembali, sementara pengumuman pra-login tetap terbaca di halaman masuk.

`message` kosong atau tidak dikirim berarti frontend memakai teks baku `MaintenanceService::DEFAULT_NOTICE`. `estimatedEndAt` memakai ISO-8601 ber-offset dan **wajib diisi selama `isEnabled = true`**; nilainya harus waktu yang akan datang, selain itu `422`.

`estimatedEndAt` adalah tenggat yang mengikat: begitu waktunya lewat, `MaintenanceService` otomatis mematikan maintenance pada request berikutnya, sehingga situs kembali dapat diakses tanpa admin perlu mematikannya manual. Respons `GET`/`PUT /maintenance` selalu mencerminkan status terbaru (`isEnabled` ikut berubah menjadi `false` setelah tenggat lewat). Frontend memantau status ini secara berkala (interval memendek mendekati tenggat) agar halaman peminjam terbuka kembali sendiri.

## 13. Informasi & Attention (`/attention-messages`)

Pesan yang ditulis administrator dan ditampilkan sebagai modal setelah pengguna berhasil login, atau sebagai pengumuman di halaman masuk sebelum login.

| Method | Path | Akses | Catatan |
| --- | --- | --- | --- |
| GET | `/attention-messages` | `jwt` | feed pasca-login untuk role yang sedang login |
| GET | `/attention-messages/public` | publik | feed pra-login; tetap terbuka saat maintenance |
| GET | `/attention-messages/manage` | `KABAG_UMUM`, `KASUBAG_UMUM` | seluruh pesan, termasuk yang nonaktif |
| POST | `/attention-messages/manage` | `KABAG_UMUM`, `KASUBAG_UMUM` | |
| PUT | `/attention-messages/manage/{id}` | `KABAG_UMUM`, `KASUBAG_UMUM` | |
| DELETE | `/attention-messages/manage/{id}` | `KABAG_UMUM`, `KASUBAG_UMUM` | body harus kosong |

Body: `title` (3-150 karakter), `message` (5-2000 karakter), `audienceRole`, `placement?` (`AFTER_LOGIN` bawaan, atau `BEFORE_LOGIN`), `isActive?`, `sortOrder?` (0-999).

- `audienceRole` berisi salah satu nilai `Role` atau `ALL` untuk seluruh pegawai.
- `GET /attention-messages` mengembalikan pesan `isActive` dengan `placement = AFTER_LOGIN` dan `audienceRole` cocok dengan role pemanggil atau `ALL`, diurutkan `sortOrder` lalu `createdAt`.
- `GET /attention-messages/public` mengembalikan pesan `isActive` dengan `placement = BEFORE_LOGIN`. Pemanggilnya belum punya role, jadi `audienceRole` tidak difilter di sini.
- Frontend membaca feed pasca-login sekali tepat setelah login berhasil; feed pra-login dibaca halaman masuk setiap kali dibuka.

## 14. Endpoint yang Tidak Ada

Beberapa dokumen lama menyebut endpoint yang tidak pernah diimplementasikan. Jangan dipakai:

- `POST /auth/register` - akun dibuat administrator lewat `php artisan admin:create-administrator` atau menu manajemen pengguna.
- `PATCH /bookings/{id}/status` - digantikan transisi per tahap di atas.
- `GET /bookings/pending-count` - tidak ada di kode; hitungan antrean dihitung dari daftar pengajuan.