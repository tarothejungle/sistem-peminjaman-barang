<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

final class CreateAdministratorCommand extends Command
{
    protected $signature = 'admin:create-administrator
                            {--name= : Full name}
                            {--username= : Login username}
                            {--email= : Email address used for password recovery}
                            {--role=KABAG_UMUM : KABAG_UMUM or KASUBAG_UMUM}';

    protected $description = 'Create a KABAG_UMUM or KASUBAG_UMUM administrator account';

    public function handle(): int
    {
        $name = (string) ($this->option('name') ?: $this->ask('Full name'));
        $username = (string) ($this->option('username') ?: $this->ask('Username'));
        $email = (string) ($this->option('email') ?: $this->ask('Email'));
        $password = (string) $this->secret('Password (min 12 chars)');
        $roleOption = strtoupper((string) $this->option('role'));

        $role = Role::tryFrom($roleOption);
        if ($role === null || ! $role->isAdministrator()) {
            $this->error('Role harus KABAG_UMUM atau KASUBAG_UMUM.');

            return self::FAILURE;
        }

        $validator = Validator::make(
            ['full_name' => $name, 'username' => $username, 'email' => $email, 'password' => $password],
            [
                'full_name' => ['required', 'string', 'min:3', 'max:100'],
                'username' => ['required', 'string', 'min:3', 'max:50', 'regex:/^[A-Za-z0-9._-]+$/'],
                'email' => ['required', 'email:rfc', 'max:255'],
                'password' => ['required', 'string', 'min:12', 'max:72'],
            ],
        );

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $message) {
                $this->error($message);
            }

            return self::FAILURE;
        }

        $email = strtolower(trim($email));
        $username = strtolower(trim($username));

        if (User::query()->whereRaw('LOWER(username) = ?', [$username])->exists()) {
            $this->error("Username {$username} already exists.");

            return self::FAILURE;
        }

        if (User::query()->whereRaw('LOWER(email) = ?', [$email])->exists()) {
            $this->error("Email {$email} already exists.");

            return self::FAILURE;
        }

        $user = User::query()->create([
            'full_name' => trim($name),
            'username' => $username,
            'email' => $email,
            'password_hash' => Hash::make($password),
            'role' => $role,
        ]);

        $this->info("Administrator created: {$user->username} ({$role->value}) — {$user->id}");

        return self::SUCCESS;
    }
}
