<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Services\JwtService;
use Tests\TestCase;

final class ChangePasswordValidationTest extends TestCase
{
    public function test_change_password_requires_authentication(): void
    {
        $this->patchJson('/api/v1/auth/password', [
            'currentPassword' => 'old-password',
            'newPassword' => 'new-password',
            'newPassword_confirmation' => 'new-password',
        ])->assertUnauthorized();
    }

    public function test_change_password_rejects_mismatched_confirmation_before_database_access(): void
    {
        $token = app(JwtService::class)->access('user-id', Role::PEMOHON);

        $this->withToken($token)->patchJson('/api/v1/auth/password', [
            'currentPassword' => 'old-password',
            'newPassword' => 'new-password',
            'newPassword_confirmation' => 'different-password',
        ])->assertBadRequest()->assertJsonPath('error.message', 'Data tidak valid');
    }
}
