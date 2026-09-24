<?php

declare(strict_types=1);

namespace App\Enums;

enum BookingStatus: string
{
    case PENDING_PJ_REVIEW = 'PENDING_PJ_REVIEW';
    case PENDING_KABAG_APPROVAL = 'PENDING_KABAG_APPROVAL';
    case APPROVED = 'APPROVED';
    case ALTERNATIVE_OFFERED = 'ALTERNATIVE_OFFERED';
    case CONFIRMED = 'CONFIRMED';
    case PREPARING = 'PREPARING';
    case IN_USE = 'IN_USE';
    case FINISHED_PENDING_INSPECTION = 'FINISHED_PENDING_INSPECTION';
    case COMPLETED = 'COMPLETED';
    case REJECTED = 'REJECTED';
    case CANCELLED = 'CANCELLED';

    /**
     * Human wording for the workflow stage.
     *
     * The approval stage is named after KASUBAG_UMUM because that role carries the
     * full administrative mandate; KABAG_UMUM only monitors the queue. Reports and
     * exported files read the label from here so the wording cannot drift.
     */
    public function label(): string
    {
        return match ($this) {
            self::PENDING_PJ_REVIEW => 'Menunggu Pemeriksaan PJ',
            self::PENDING_KABAG_APPROVAL => 'Menunggu Persetujuan Kasubag',
            self::APPROVED => 'Disetujui',
            self::ALTERNATIVE_OFFERED => 'Alternatif Ditawarkan',
            self::CONFIRMED => 'Dikonfirmasi',
            self::PREPARING => 'Sedang Dipersiapkan',
            self::IN_USE => 'Sedang Digunakan',
            self::FINISHED_PENDING_INSPECTION => 'Menunggu Inspeksi',
            self::COMPLETED => 'Selesai',
            self::REJECTED => 'Ditolak',
            self::CANCELLED => 'Dibatalkan',
        };
    }
}
