<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\UpdateMaintenanceSettingRequest;
use App\Models\MaintenanceSetting;
use App\Services\MaintenanceService;
use Illuminate\Http\JsonResponse;

final class MaintenanceSettingController extends Controller
{
    public function __construct(private readonly MaintenanceService $maintenance) {}

    /** Public: the frontend reads this before it decides what to render. */
    public function show(): JsonResponse
    {
        return response()->json(['data' => $this->present($this->maintenance->settings())]);
    }

    public function update(UpdateMaintenanceSettingRequest $request): JsonResponse
    {
        $settings = $this->maintenance->update($request->validated(), $request->attributes->get('auth_user_id'));

        return response()->json(['data' => $this->present($settings)]);
    }

    private function present(MaintenanceSetting $settings): array
    {
        return [
            'isEnabled' => (bool) $settings->is_enabled,
            'message' => $this->maintenance->noticeText($settings),
            'estimatedEndAt' => $settings->estimated_end_at?->toIso8601String(),
            'updatedAt' => $settings->updated_at?->toIso8601String(),
        ];
    }
}
