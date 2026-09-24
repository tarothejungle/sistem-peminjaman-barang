<?php

declare(strict_types=1);

namespace App\Http\Requests\Concerns;

/**
 * Shared validation for the 64-char hex password-reset token, kept in one place
 * so the reset and verify endpoints cannot drift apart.
 */
trait ValidatesResetToken
{
    /**
     * @return list<string>
     */
    protected function resetTokenRules(): array
    {
        return ['required', 'string', 'size:64', 'regex:/^[a-f0-9]+$/'];
    }

    /**
     * @return array<string, string>
     */
    protected function resetTokenMessages(): array
    {
        return [
            'token.size' => 'Token reset password tidak valid',
            'token.regex' => 'Token reset password tidak valid',
        ];
    }
}
