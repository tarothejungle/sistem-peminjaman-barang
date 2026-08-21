<?php

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
                            {--email= : Email address}
                            {--password= : Password (min 8 chars)}';

    protected $description = 'Create a KABAG_UMUM administrator account';

    public function handle(): int
    {
        $name = (string) ($this->option('name') ?: $this->ask('Full name'));
        $email = (string) ($this->option('email') ?: $this->ask('Email'));
        $password = (string) ($this->option('password') ?: $this->secret('Password (min 8 chars)'));

        $validator = Validator::make(
            ['full_name' => $name, 'email' => $email, 'password' => $password],
            [
                'full_name' => ['required', 'string', 'min:3', 'max:100'],
                'email' => ['required', 'email:rfc', 'max:255'],
                'password' => ['required', 'string', 'min:8', 'max:72'],
            ],
        );

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $message) {
                $this->error($message);
            }

            return self::FAILURE;
        }

        $email = strtolower(trim($email));

        if (User::query()->where('email', $email)->exists()) {
            $this->error("Email {$email} already exists.");

            return self::FAILURE;
        }

        $user = User::query()->create([
            'full_name' => trim($name),
            'email' => $email,
            'password_hash' => Hash::make($password),
            'role' => Role::KABAG_UMUM,
        ]);

        $this->info("Administrator created: {$user->email} ({$user->id})");

        return self::SUCCESS;
    }
}
