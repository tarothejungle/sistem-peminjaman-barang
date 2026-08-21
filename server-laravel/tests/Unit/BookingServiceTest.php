<?php

namespace Tests\Unit;

use App\Enums\BookingStatus;
use App\Services\BookingService;
use PHPUnit\Framework\TestCase;

final class BookingServiceTest extends TestCase
{
    public function test_duplicate_item_quantities_are_normalized(): void
    {
        $items = (new BookingService)->normalizeItems([
            ['itemId' => 'item-a', 'quantity' => 2],
            ['itemId' => 'item-b', 'quantity' => 1],
            ['itemId' => 'item-a', 'quantity' => 3],
        ]);

        $this->assertSame([
            ['itemId' => 'item-a', 'quantity' => 5],
            ['itemId' => 'item-b', 'quantity' => 1],
        ], $items);
    }

    public function test_all_non_terminal_workflow_statuses_reserve_availability(): void
    {
        $this->assertSame([
            BookingStatus::PENDING_PJ_REVIEW->value,
            BookingStatus::PENDING_KABAG_APPROVAL->value,
            BookingStatus::APPROVED->value,
            BookingStatus::ALTERNATIVE_OFFERED->value,
            BookingStatus::CONFIRMED->value,
            BookingStatus::PREPARING->value,
            BookingStatus::IN_USE->value,
            BookingStatus::FINISHED_PENDING_INSPECTION->value,
        ], BookingService::overlapStatuses());

        $this->assertEmpty(array_intersect([
            BookingStatus::COMPLETED->value,
            BookingStatus::REJECTED->value,
            BookingStatus::CANCELLED->value,
        ], BookingService::overlapStatuses()));
    }
}
