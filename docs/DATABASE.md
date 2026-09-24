# Database Schema - PostgreSQL

Skema aktif dikelola lewat migrasi Laravel di `be/database/migrations/`. Tidak ada Prisma di repo ini.

## 1. Koneksi

- Engine: PostgreSQL 17 (16 aman)
- `DB_CONNECTION=pgsql`, `DB_HOST`, `DB_PORT=5432`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`
- `DB_TIMEZONE=UTC` - semua kolom waktu disimpan UTC; perhitungan zona dilakukan di aplikasi
- `DB_SSLMODE`: `disable` hanya untuk host lokal; database remote wajib `require`, `verify-ca`, atau `verify-full` (dipaksa saat production)
- Membuat skema: `php artisan migrate`

## 2. Tipe Enum PostgreSQL

- `Role`: `PEMOHON`, `PJ_RUANGAN`, `KABAG_UMUM`, `KASUBAG_UMUM`
- `BookingStatus`: `PENDING_PJ_REVIEW`, `PENDING_KABAG_APPROVAL`, `APPROVED`, `ALTERNATIVE_OFFERED`, `CONFIRMED`, `PREPARING`, `IN_USE`, `FINISHED_PENDING_INSPECTION`, `COMPLETED`, `REJECTED`, `CANCELLED`
- `ResourceType`: `ROOM`, `ITEM`

## 3. Tabel

### users

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| id | UUID | primary key |
| full_name | VARCHAR(100) | |
| username | VARCHAR(50) | kredensial login, unik case-insensitive |
| email | VARCHAR(255) | untuk pemulihan password, unik case-insensitive |
| password_hash | VARCHAR(255) | hash bcrypt |
| role | Role | default `PEMOHON` |
| credit_score | INTEGER | default 100, CHECK >= 0; batas atas 100 ditegakkan di `CreditScoreService`, bukan constraint |
| phone_number | VARCHAR(20) | nullable |
| profile_image_path | VARCHAR(255) | nullable, disembunyikan dari response |
| profile_image_mime | VARCHAR(50) | nullable, disembunyikan dari response |
| created_at, updated_at | TIMESTAMP(3) | |

### rooms

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| id | UUID | primary key |
| name | VARCHAR(100) | |
| capacity | INTEGER | CHECK > 0 |
| location | VARCHAR(100) | |
| facilities | TEXT[] | default `{}`, lewat cast `App\Casts\PostgresTextArray` |
| is_active | BOOLEAN | default TRUE |
| image_path, image_mime | VARCHAR | nullable, disembunyikan dari response |
| created_at, updated_at | TIMESTAMP(3) | |

### items

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| id | UUID | primary key |
| name | VARCHAR(100) | |
| total_stock | INTEGER | CHECK >= 0 |
| category | VARCHAR(50) | |
| plate_number | VARCHAR(20) | nullable, dipakai inventaris kendaraan |
| is_active | BOOLEAN | default TRUE |
| image_path, image_mime | VARCHAR | nullable, disembunyikan dari response |
| created_at, updated_at | TIMESTAMP(3) | |

### bookings

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| id | UUID | primary key |
| user_id | UUID | FK ke `users`, ON DELETE RESTRICT |
| resource_type | ResourceType | `ROOM` atau `ITEM` |
| room_id | UUID | nullable, FK ke `rooms`, ON DELETE SET NULL |
| responsible_name | VARCHAR(100) | NOT NULL |
| phone_number | VARCHAR(20) | NOT NULL |
| work_unit | VARCHAR(150) | nullable, hanya untuk peminjaman ruang |
| start_time, end_time | TIMESTAMP(3) | CHECK `start_time < end_time` |
| purpose | TEXT | |
| status | BookingStatus | default `PENDING_PJ_REVIEW` |
| returned_at | TIMESTAMP(3) | nullable, diisi saat pemohon konfirmasi selesai; untuk peminjaman ruang yang ditutup otomatis berisi jam selesai pemakaian sesuai jadwal |
| auto_confirmed_at | TIMESTAMP(3) | nullable, diisi hanya ketika sistem yang menutup peminjaman ruang (lihat `bookings:auto-confirm-rooms`) |
| alternative_room_id | UUID | nullable, FK ke `rooms`, ON DELETE SET NULL |
| alternative_start_time, alternative_end_time | TIMESTAMP(3) | nullable |
| approval_notes, inspection_notes, rejection_reason | TEXT | nullable |
| document_disk, document_path, document_original_name, document_mime, document_size | | metadata PDF Surat Peminjaman; `document_path`/`mime`/`disk` disembunyikan dari response |
| surat_tugas_disk, surat_tugas_path, surat_tugas_original_name, surat_tugas_mime, surat_tugas_size | | metadata PDF Surat Tugas (wajib untuk peminjaman kendaraan); `surat_tugas_path`/`mime`/`disk` disembunyikan dari response |
| created_at, updated_at | TIMESTAMP(3) | |

### booking_items

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| id | UUID | primary key |
| booking_id | UUID | FK ke `bookings`, ON DELETE CASCADE |
| item_id | UUID | FK ke `items`, ON DELETE RESTRICT |
| quantity | INTEGER | CHECK > 0 |

Tanpa kolom timestamp. Constraint `UNIQUE (booking_id, item_id)` mencegah barang yang sama tercatat dua kali dalam satu pengajuan.

### attention_messages

Pesan yang ditulis administrator dan ditampilkan sebagai modal setelah login, atau sebagai pengumuman di halaman masuk. Satu baris satu pesan; `audience_role` menampung nilai `Role` atau `ALL` sehingga tabel yang sama bisa melayani pengumuman untuk role lain tanpa perubahan skema.

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| id | UUID | primary key |
| title | VARCHAR(150) | |
| message | TEXT | boleh multi-paragraf, dipisah baris kosong |
| audience_role | VARCHAR(30) | default `PEMOHON`; nilai `Role` atau `ALL` |
| is_active | BOOLEAN | default TRUE |
| placement | VARCHAR(20) | default `AFTER_LOGIN`; `BEFORE_LOGIN` menampilkan pesan di halaman masuk (kolom ini menggantikan `show_on_login`) |
| sort_order | INTEGER | default 0, urutan tampil |
| created_by | UUID | nullable, FK ke `users`, ON DELETE SET NULL |
| created_at, updated_at | TIMESTAMP(3) | |

Migrasi membuat satu pesan awal: pemberitahuan Skor Kredibilitas untuk role `PEMOHON` dengan `placement AFTER_LOGIN`, memakai id tetap `a7c1f0e2-5b4d-4c9a-9f31-2e6d8b7a4c10` supaya aman dijalankan ulang.

### maintenance_settings

Tabel singleton: `id SMALLINT PRIMARY KEY CHECK (id = 1)`.

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| is_enabled | BOOLEAN | default FALSE; TRUE menutup seluruh API |
| message | TEXT | nullable; NULL berarti pakai teks baku `MaintenanceService::DEFAULT_NOTICE` |
| estimated_end_at | TIMESTAMPTZ | tenggat perbaikan; wajib diisi selama `is_enabled = true` dan menjadi acuan sistem mematikan maintenance otomatis begitu waktunya lewat |
| updated_by | UUID | nullable, FK ke `users`, ON DELETE SET NULL |
| created_at, updated_at | TIMESTAMP(3) | |

### room_booking_settings

Tabel singleton: `id SMALLINT PRIMARY KEY CHECK (id = 1)`.

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| start_time, end_time | TIME | default `08:00` dan `16:00` |
| morning_start_time, morning_end_time | TIME | default `08:00` dan `12:00` |
| afternoon_start_time, afternoon_end_time | TIME | default `13:00` dan `16:00` |
| timezone | VARCHAR(64) | default `Asia/Jakarta` |
| updated_by | UUID | nullable, FK ke `users`, ON DELETE SET NULL |

Constraint `room_booking_settings_slots_check` memaksa `morning_end_time <= afternoon_start_time` serta `start_time = morning_start_time` dan `end_time = afternoon_end_time`.

### auth_sessions

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| id | UUID | primary key, dipakai sebagai `sid` di JWT |
| user_id | UUID | FK ke `users`, ON DELETE CASCADE |
| refresh_token_hash | VARCHAR(64) | unik, hash SHA-256 dari refresh token |
| last_activity_at | TIMESTAMPTZ | dasar perhitungan batas tidak aktif |
| expires_at | TIMESTAMPTZ | |
| revoked_at | TIMESTAMPTZ | nullable |

### password_reset_tokens

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| id | UUID | primary key |
| user_id | UUID | |
| token_hash | VARCHAR(64) | unik |
| expires_at | TIMESTAMP | |
| used_at | TIMESTAMP | nullable |

### user_notifications

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| id | UUID | primary key |
| user_id | UUID | FK ke `users`, ON DELETE CASCADE |
| booking_id | UUID | nullable, FK ke `bookings`, ON DELETE SET NULL |
| type | VARCHAR(50) | |
| title | VARCHAR(150) | |
| message | TEXT | |
| read_at | TIMESTAMP(3) | nullable |

### login_activities

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| id | UUID | primary key |
| user_id | UUID | FK ke `users`, ON DELETE CASCADE |
| auth_session_id | UUID | unik, FK ke `auth_sessions`, ON DELETE CASCADE |
| logged_in_at | TIMESTAMPTZ | |

### user_credit_events

Ledger append-only untuk skor kredibilitas pemohon.

| Kolom | Tipe | Catatan |
| --- | --- | --- |
| id | UUID | primary key |
| user_id | UUID | FK ke `users`, ON DELETE CASCADE |
| booking_id | UUID | nullable dan **unik**, FK ke `bookings`, ON DELETE SET NULL |
| delta | INTEGER | mis. +5 tepat waktu, -5 terlambat |
| score_after | INTEGER | skor setelah perubahan |
| reason | VARCHAR(50) | mis. `RETURNED_ON_TIME`, `RETURNED_LATE` |

Keunikan `booking_id` memastikan satu peminjaman hanya mengubah skor sekali, sehingga konfirmasi selesai yang terulang tidak menggandakan poin.

## 4. Index Penting

- `users_email_key` (unique email), `users_email_lower_key` dan `users_username_lower_key` (unique case-insensitive)
- `bookings_user_id_idx`, `bookings_status_idx`
- `bookings_room_schedule_idx` pada `(room_id, status, start_time, end_time)` - menopang pengecekan jadwal bentrok
- `bookings_alternative_room_id_idx`
- `booking_items_booking_id_idx`, `booking_items_item_id_idx`
- `user_notifications_inbox_idx` pada `(user_id, read_at, created_at)`
- `login_activities(logged_in_at)` dan `(user_id, logged_in_at)`
- `attention_messages_audience_idx` pada `(audience_role, is_active)` - menopang query feed per role

## 5. Catatan Operasional

- Migrasi awal (`2026_08_19_000000_create_sistem_peminjaman_schema.php`) dan beberapa migrasi lanjutan **menolak berjalan di luar PostgreSQL**; keduanya melempar `RuntimeException` bila driver bukan `pgsql`. Perubahan skema harus diuji pada PostgreSQL.
- Sebaliknya, test Feature berjalan di SQLite in-memory dan membangun skema sendiri lewat `Schema::create()`, bukan menjalankan migrasi. Lihat `docs/ARCHITECTURE.md` bagian Testing.
- `2026_09_01_000000_add_username_kasubag_role_and_password_resets.php` memakai `public $withinTransaction = false;` karena PostgreSQL melarang pemakaian label enum yang baru ditambahkan di dalam transaksi yang sama.
- Kolom `facilities` (TEXT[]) harus diakses lewat cast `PostgresTextArray`, bukan `json_decode` manual.
