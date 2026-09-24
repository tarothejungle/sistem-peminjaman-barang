<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement(<<<'SQL'
            ALTER TABLE bookings
                ADD COLUMN IF NOT EXISTS responsible_name VARCHAR(100),
                ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20),
                ADD COLUMN IF NOT EXISTS alternative_room_id UUID NULL
            SQL);
        DB::statement(<<<'SQL'
            UPDATE bookings AS booking
            SET responsible_name = COALESCE(NULLIF(BTRIM(booking.responsible_name), ''), NULLIF(BTRIM(users.full_name), ''), 'Penanggung Jawab'),
                phone_number = COALESCE(NULLIF(BTRIM(booking.phone_number), ''), '-')
            FROM users
            WHERE users.id = booking.user_id
              AND (booking.responsible_name IS NULL OR BTRIM(booking.responsible_name) = '' OR booking.phone_number IS NULL OR BTRIM(booking.phone_number) = '')
            SQL);
        DB::statement(<<<'SQL'
            UPDATE bookings
            SET responsible_name = COALESCE(NULLIF(BTRIM(responsible_name), ''), 'Penanggung Jawab'),
                phone_number = COALESCE(NULLIF(BTRIM(phone_number), ''), '-')
            WHERE responsible_name IS NULL OR BTRIM(responsible_name) = '' OR phone_number IS NULL OR BTRIM(phone_number) = ''
            SQL);
        DB::statement(<<<'SQL'
            ALTER TABLE bookings
                ALTER COLUMN responsible_name SET NOT NULL,
                ALTER COLUMN phone_number SET NOT NULL
            SQL);
        DB::statement(<<<'SQL'
            ALTER TABLE bookings
                DROP CONSTRAINT IF EXISTS bookings_alternative_room_id_fkey
            SQL);
        DB::statement(<<<'SQL'
            ALTER TABLE bookings
                ADD CONSTRAINT bookings_alternative_room_id_fkey
                FOREIGN KEY (alternative_room_id) REFERENCES rooms(id)
                ON DELETE SET NULL ON UPDATE CASCADE
            SQL);
        DB::statement(<<<'SQL'
            CREATE INDEX IF NOT EXISTS bookings_alternative_room_id_idx
                ON bookings(alternative_room_id)
            SQL);
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS bookings_alternative_room_id_idx');
        DB::statement('ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_alternative_room_id_fkey');
        DB::statement(<<<'SQL'
            ALTER TABLE bookings
                DROP COLUMN IF EXISTS alternative_room_id,
                DROP COLUMN IF EXISTS phone_number,
                DROP COLUMN IF EXISTS responsible_name
            SQL);
    }
};
