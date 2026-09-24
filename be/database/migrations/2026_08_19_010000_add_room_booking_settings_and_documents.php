<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            throw new RuntimeException('Migration pengaturan peminjaman membutuhkan PostgreSQL.');
        }

        DB::unprepared(<<<'SQL'
            CREATE TABLE IF NOT EXISTS room_booking_settings (
                id SMALLINT PRIMARY KEY CHECK (id = 1),
                start_time TIME NOT NULL,
                end_time TIME NOT NULL,
                timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Jakarta',
                updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
                created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT room_booking_settings_time_check CHECK (start_time < end_time)
            );

            INSERT INTO room_booking_settings (id, start_time, end_time, timezone)
            VALUES (1, '08:00', '16:00', 'Asia/Jakarta')
            ON CONFLICT (id) DO NOTHING;

            ALTER TABLE bookings ADD COLUMN IF NOT EXISTS document_disk VARCHAR(50) NULL;
            ALTER TABLE bookings ADD COLUMN IF NOT EXISTS document_path VARCHAR(500) NULL;
            ALTER TABLE bookings ADD COLUMN IF NOT EXISTS document_original_name VARCHAR(255) NULL;
            ALTER TABLE bookings ADD COLUMN IF NOT EXISTS document_mime VARCHAR(100) NULL;
            ALTER TABLE bookings ADD COLUMN IF NOT EXISTS document_size BIGINT NULL;
            SQL);
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::unprepared(<<<'SQL'
            ALTER TABLE bookings DROP COLUMN IF EXISTS document_size;
            ALTER TABLE bookings DROP COLUMN IF EXISTS document_mime;
            ALTER TABLE bookings DROP COLUMN IF EXISTS document_original_name;
            ALTER TABLE bookings DROP COLUMN IF EXISTS document_path;
            ALTER TABLE bookings DROP COLUMN IF EXISTS document_disk;
            DROP TABLE IF EXISTS room_booking_settings;
            SQL);
    }
};
