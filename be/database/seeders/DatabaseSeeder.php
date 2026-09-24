<?php

namespace Database\Seeders;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Demo accounts share one known password and @example.test addresses, so
        // they must never appear on a production database.
        if (app()->environment('production')) {
            $this->command?->warn('DatabaseSeeder dilewati: akun demo tidak dibuat pada environment production.');

            return;
        }

        $password = env('SEED_DEFAULT_PASSWORD');

        if (! is_string($password) || strlen($password) < 8) {
            $this->command?->warn('SEED_DEFAULT_PASSWORD tidak tersedia atau kurang dari 8 karakter. Akun development tidak dibuat.');

            return;
        }

        $users = [
            ['full_name' => 'Pemohon Development', 'username' => 'pemohon', 'email' => 'pemohon@example.test', 'role' => Role::PEMOHON],
            ['full_name' => 'PJ Ruangan Development', 'username' => 'pj.ruangan', 'email' => 'pj.ruangan@example.test', 'role' => Role::PJ_RUANGAN],
            ['full_name' => 'Kabag Umum Development', 'username' => 'kabag.umum', 'email' => 'kabag.umum@example.test', 'role' => Role::KABAG_UMUM],
        ];

        foreach ($users as $user) {
            User::query()->updateOrCreate(
                ['email' => $user['email']],
                [
                    'full_name' => $user['full_name'],
                    'username' => $user['username'],
                    'password_hash' => Hash::make($password),
                    'role' => $user['role'],
                ],
            );
        }
    }
}
