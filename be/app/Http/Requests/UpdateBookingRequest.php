<?php

declare(strict_types=1);

namespace App\Http\Requests;

final class UpdateBookingRequest extends CreateBookingRequest
{
    /**
     * An update may keep the PDF already stored on the booking, so — unlike a
     * fresh submission — a multi-day range does not force a new upload. Every
     * other rule (full-day slot, PDF signature) is inherited unchanged.
     */
    protected function requiresDocumentForMultiDay(): bool
    {
        return false;
    }
}
