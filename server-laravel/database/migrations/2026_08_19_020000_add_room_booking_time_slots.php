<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            throw new RuntimeException('Migration slot peminjaman ruangan membutuhkan PostgreSQL.');
        }

        DB::unprepared(<<<'SQL'
            ALTER TABLE room_booking_settings
                ADD COLUMN IF NOT EXISTS morning_start_time TIME NOT NULL DEFAULT '08:00',
                ADD COLUMN IF NOT EXISTS morning_end_time TIME NOT NULL DEFAULT '12:00',
                ADD COLUMN IF NOT EXISTS afternoon_start_time TIME NOT NULL DEFAULT '13:00',
                ADD COLUMN IF NOT EXISTS afternoon_end_time TIME NOT NULL DEFAULT '16:00';

            UPDATE room_booking_settings SET
                morning_start_time = '08:00',
                morning_end_time = '12:00',
                afternoon_start_time = '13:00',
                afternoon_end_time = '16:00',
                start_time = '08:00',
                end_time = '16:00'
            WHERE id = 1;

            ALTER TABLE room_booking_settings
                DROP CONSTRAINT IF EXISTS room_booking_settings_slots_check;

            ALTER TABLE room_booking_settings
                ADD CONSTRAINT room_booking_settings_slots_check CHECK (
                    morning_start_time < morning_end_time
                    AND afternoon_start_time < afternoon_end_time
                    AND morning_end_time <= afternoon_start_time
                    AND start_time = morning_start_time
                    AND end_time = afternoon_end_time
                );
            SQL);
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::unprepared(<<<'SQL'
            ALTER TABLE room_booking_settings DROP CONSTRAINT IF EXISTS room_booking_settings_slots_check;
            ALTER TABLE room_booking_settings
                DROP COLUMN IF EXISTS afternoon_end_time,
                DROP COLUMN IF EXISTS afternoon_start_time,
                DROP COLUMN IF EXISTS morning_end_time,
                DROP COLUMN IF EXISTS morning_start_time;
            SQL);
    }
};
