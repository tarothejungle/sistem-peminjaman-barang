<?php

namespace App\Services;

use App\Enums\RoomBookingSlot;
use App\Exceptions\ApiException;
use App\Models\RoomBookingSetting;
use Carbon\CarbonImmutable;

final class RoomBookingScheduleService
{
    public function settings(): RoomBookingSetting
    {
        return RoomBookingSetting::find(1) ?? RoomBookingSetting::create([
            'id' => 1,
            'start_time' => '08:00:00',
            'end_time' => '16:00:00',
            'morning_start_time' => '08:00:00',
            'morning_end_time' => '12:00:00',
            'afternoon_start_time' => '13:00:00',
            'afternoon_end_time' => '16:00:00',
            'timezone' => 'Asia/Jakarta',
        ]);
    }

    public function range(string $startDate, string $endDate, RoomBookingSlot $slot): array
    {
        if ($startDate !== $endDate && $slot !== RoomBookingSlot::FULL_DAY) {
            throw new ApiException('Peminjaman lebih dari satu hari wajib menggunakan kategori sehari penuh', 400);
        }

        $settings = $this->settings();
        [$startTime, $endTime] = match ($slot) {
            RoomBookingSlot::MORNING => [$settings->morning_start_time, $settings->morning_end_time],
            RoomBookingSlot::AFTERNOON => [$settings->afternoon_start_time, $settings->afternoon_end_time],
            RoomBookingSlot::FULL_DAY => [$settings->start_time, $settings->end_time],
        };
        $start = CarbonImmutable::createFromFormat('Y-m-d H:i:s', $startDate.' '.$startTime, $settings->timezone)->utc();
        $end = CarbonImmutable::createFromFormat('Y-m-d H:i:s', $endDate.' '.$endTime, $settings->timezone)->utc();

        return [$start, $end];
    }
}
