<?php

namespace App\Exceptions;

use RuntimeException;

final class ApiException extends RuntimeException
{
    public function __construct(string $message, public readonly int $status, public readonly mixed $details = null)
    {
        parent::__construct($message);
    }
}
