<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            throw new RuntimeException('Migration foto resource membutuhkan PostgreSQL.');
        }

        DB::unprepared(<<<'SQL'
            ALTER TABLE rooms ADD COLUMN IF NOT EXISTS image_path VARCHAR(500) NULL;
            ALTER TABLE rooms ADD COLUMN IF NOT EXISTS image_mime VARCHAR(50) NULL;
            ALTER TABLE items ADD COLUMN IF NOT EXISTS image_path VARCHAR(500) NULL;
            ALTER TABLE items ADD COLUMN IF NOT EXISTS image_mime VARCHAR(50) NULL;
            SQL);
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::unprepared(<<<'SQL'
            ALTER TABLE rooms DROP COLUMN IF EXISTS image_mime;
            ALTER TABLE rooms DROP COLUMN IF EXISTS image_path;
            ALTER TABLE items DROP COLUMN IF EXISTS image_mime;
            ALTER TABLE items DROP COLUMN IF EXISTS image_path;
            SQL);
    }
};
