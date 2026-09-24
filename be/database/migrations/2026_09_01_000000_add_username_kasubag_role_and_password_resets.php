<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Adds the KASUBAG_UMUM role, the users.username login credential, and the
 * password reset token store.
 *
 * PostgreSQL forbids using a freshly added enum label inside the transaction
 * that created it, so this migration opts out of the implicit wrapper.
 */
return new class extends Migration
{
    public $withinTransaction = false;

    public function up(): void
    {
        $isPostgres = DB::getDriverName() === 'pgsql';

        if ($isPostgres) {
            DB::unprepared('ALTER TYPE "Role" ADD VALUE IF NOT EXISTS \'KASUBAG_UMUM\';');
        }

        if (! Schema::hasColumn('users', 'username')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->string('username', 50)->nullable()->after('full_name');
            });
        }

        $this->backfillUsernames();
        $this->guardAgainstDuplicateEmails();

        if ($isPostgres) {
            DB::unprepared(<<<'SQL'
                ALTER TABLE users ALTER COLUMN username SET NOT NULL;
                CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_key ON users (LOWER(username));
                CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key ON users (LOWER(email));
            SQL);
        }

        if (! Schema::hasTable('password_reset_tokens')) {
            Schema::create('password_reset_tokens', function (Blueprint $table): void {
                $table->uuid('id')->primary();
                $table->uuid('user_id');
                $table->string('token_hash', 64)->unique();
                $table->timestamp('expires_at');
                $table->timestamp('used_at')->nullable();
                $table->timestamp('created_at');
                $table->index('user_id');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('password_reset_tokens');

        if (DB::getDriverName() === 'pgsql') {
            DB::unprepared(<<<'SQL'
                DROP INDEX IF EXISTS users_username_lower_key;
                ALTER TABLE users DROP COLUMN IF EXISTS username;
            SQL);

            // PostgreSQL cannot drop enum labels; KASUBAG_UMUM is left in place.
            return;
        }

        if (Schema::hasColumn('users', 'username')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->dropColumn('username');
            });
        }
    }

    /**
     * Derives a unique username from the local part of each existing email so the
     * column can become NOT NULL without stranding legacy accounts.
     */
    private function backfillUsernames(): void
    {
        $taken = DB::table('users')
            ->whereNotNull('username')
            ->where('username', '<>', '')
            ->pluck('username')
            ->mapWithKeys(static fn ($value): array => [strtolower((string) $value) => true])
            ->all();

        DB::table('users')
            ->where(function ($query): void {
                $query->whereNull('username')->orWhere('username', '');
            })
            ->orderBy('created_at')
            ->get(['id', 'email'])
            ->each(function ($row) use (&$taken): void {
                $local = (string) strstr((string) $row->email.'@', '@', true);
                $base = preg_replace('/[^a-z0-9._-]/', '', strtolower($local)) ?? '';
                $base = substr($base, 0, 40);
                if ($base === '') {
                    $base = 'user';
                }

                $candidate = $base;
                $suffix = 1;
                while (isset($taken[$candidate])) {
                    $suffix++;
                    $candidate = $base.$suffix;
                }
                $taken[$candidate] = true;

                DB::table('users')->where('id', $row->id)->update(['username' => $candidate]);
            });
    }

    /**
     * Password recovery resolves an account by email, so duplicates would make the
     * flow ambiguous. Fail loudly with actionable data instead of silently skipping.
     */
    private function guardAgainstDuplicateEmails(): void
    {
        $duplicates = DB::table('users')
            ->selectRaw('LOWER(email) AS normalized_email, COUNT(*) AS total')
            ->groupByRaw('LOWER(email)')
            ->havingRaw('COUNT(*) > 1')
            ->pluck('normalized_email')
            ->all();

        if ($duplicates !== []) {
            throw new RuntimeException(
                'Tidak dapat menerapkan unique index email. Email duplikat: '.implode(', ', $duplicates)
                .'. Perbaiki data tersebut lalu jalankan migrasi kembali.',
            );
        }
    }
};
