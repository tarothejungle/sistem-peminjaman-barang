<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\UpdateDisabledMenusRequest;
use App\Services\DisabledMenuService;
use Illuminate\Http\JsonResponse;

final class DisabledMenuController extends Controller
{
    public function __construct(private readonly DisabledMenuService $menus) {}

    public function index(): JsonResponse
    {
        return response()->json(['data' => ['disabledMenuKeys' => $this->menus->disabledKeys()]]);
    }

    public function update(UpdateDisabledMenusRequest $request): JsonResponse
    {
        $keys = $this->menus->update(
            $request->validated('disabledMenuKeys'),
            $request->attributes->get('auth_user_id'),
        );

        return response()->json(['data' => ['disabledMenuKeys' => $keys]]);
    }
}
