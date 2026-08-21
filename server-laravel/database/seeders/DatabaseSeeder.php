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
        $password = env('SEED_DEFAULT_PASSWORD');

        if (! is_string($password) || strlen($password) < 8) {
            $this->command?->warn('SEED_DEFAULT_PASSWORD tidak tersedia atau kurang dari 8 karakter. Akun development tidak dibuat.');

            return;
        }

        $users = [
            ['full_name' => 'Pemohon Development', 'email' => 'pemohon@example.test', 'role' => Role::PEMOHON],
            ['full_name' => 'PJ Ruangan Development', 'email' => 'pj.ruangan@example.test', 'role' => Role::PJ_RUANGAN],
            ['full_name' => 'Kabag Umum Development', 'email' => 'kabag.umum@example.test', 'role' => Role::KABAG_UMUM],
        ];

        foreach ($users as $user) {
            User::query()->updateOrCreate(
                ['email' => $user['email']],
                [
                    'full_name' => $user['full_name'],
                    'password_hash' => Hash::make($password),
                    'role' => $user['role'],
                ],
            );
        }
    }
}
