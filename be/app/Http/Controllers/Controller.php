<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Exceptions\ApiException;

abstract class Controller
{
    /**
     * The canonical RFC 4122 UUID shape. Malformed ids are rejected before they
     * reach the database so they fail fast with a 400 instead of a driver error.
     */
    private const UUID_PATTERN = '/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i';

    protected function assertUuid(string $id, string $message = 'ID tidak valid'): void
    {
        if (! preg_match(self::UUID_PATTERN, $id)) {
            throw new ApiException($message, 400);
        }
    }
}
