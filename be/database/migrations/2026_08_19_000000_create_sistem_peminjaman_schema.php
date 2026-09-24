<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            throw new RuntimeException('Migration sistem peminjaman membutuhkan PostgreSQL.');
        }

        DB::unprepared(<<<'SQL'
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Role') THEN
                    CREATE TYPE "Role" AS ENUM ('PEMOHON', 'PJ_RUANGAN', 'KABAG_UMUM');
                END IF;

                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BookingStatus') THEN
                    CREATE TYPE "BookingStatus" AS ENUM (
                        'PENDING_PJ_REVIEW',
                        'PENDING_KABAG_APPROVAL',
                        'APPROVED',
                        'ALTERNATIVE_OFFERED',
                        'CONFIRMED',
                        'PREPARING',
                        'IN_USE',
                        'FINISHED_PENDING_INSPECTION',
                        'COMPLETED',
                        'REJECTED',
                        'CANCELLED'
                    );
                END IF;

                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ResourceType') THEN
                    CREATE TYPE "ResourceType" AS ENUM ('ROOM', 'ITEM');
                END IF;
            END
            $$;

            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY,
                full_name VARCHAR(100) NOT NULL,
                email VARCHAR(255) NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role "Role" NOT NULL DEFAULT 'PEMOHON',
                created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP(3) NOT NULL
            );

            CREATE TABLE IF NOT EXISTS rooms (
                id UUID PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                capacity INTEGER NOT NULL CHECK (capacity > 0),
                location VARCHAR(100) NOT NULL,
                facilities TEXT[] NOT NULL DEFAULT '{}',
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP(3) NOT NULL
            );

            CREATE TABLE IF NOT EXISTS items (
                id UUID PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                total_stock INTEGER NOT NULL CHECK (total_stock >= 0),
                category VARCHAR(50) NOT NULL,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP(3) NOT NULL
            );

            CREATE TABLE IF NOT EXISTS bookings (
                id UUID PRIMARY KEY,
                user_id UUID NOT NULL,
                resource_type "ResourceType" NOT NULL,
                room_id UUID NULL,
                start_time TIMESTAMP(3) NOT NULL,
                end_time TIMESTAMP(3) NOT NULL,
                purpose TEXT NOT NULL,
                status "BookingStatus" NOT NULL DEFAULT 'PENDING_PJ_REVIEW',
                alternative_start_time TIMESTAMP(3) NULL,
                alternative_end_time TIMESTAMP(3) NULL,
                approval_notes TEXT NULL,
                inspection_notes TEXT NULL,
                rejection_reason TEXT NULL,
                created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP(3) NOT NULL,
                CONSTRAINT bookings_time_check CHECK (start_time < end_time),
                CONSTRAINT bookings_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
                CONSTRAINT bookings_room_id_fkey FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL ON UPDATE CASCADE
            );

            CREATE TABLE IF NOT EXISTS booking_items (
                id UUID PRIMARY KEY,
                booking_id UUID NOT NULL,
                item_id UUID NOT NULL,
                quantity INTEGER NOT NULL CHECK (quantity > 0),
                CONSTRAINT booking_items_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE ON UPDATE CASCADE,
                CONSTRAINT booking_items_item_id_fkey FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT ON UPDATE CASCADE,
                CONSTRAINT booking_items_booking_item_unique UNIQUE (booking_id, item_id)
            );

            CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON users(email);
            CREATE INDEX IF NOT EXISTS bookings_user_id_idx ON bookings(user_id);
            CREATE INDEX IF NOT EXISTS bookings_room_schedule_idx ON bookings(room_id, status, start_time, end_time);
            CREATE INDEX IF NOT EXISTS bookings_status_idx ON bookings(status);
            CREATE INDEX IF NOT EXISTS booking_items_booking_id_idx ON booking_items(booking_id);
            CREATE INDEX IF NOT EXISTS booking_items_item_id_idx ON booking_items(item_id);
            SQL);
    }

    public function down(): void
    {
        // Intentionally non-destructive because this migration can baseline a schema created by Prisma.
    }
};
