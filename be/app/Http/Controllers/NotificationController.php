<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\UserNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $notifications = UserNotification::where('user_id', $request->attributes->get('auth_user_id'))
            ->latest()
            ->limit(30)
            ->get();

        return response()->json(['data' => [
            'notifications' => $notifications,
            'unreadCount' => $notifications->whereNull('read_at')->count(),
        ]]);
    }

    public function markRead(Request $request, string $id): JsonResponse
    {
        if ($request->all() !== []) {
            throw new ApiException('Data tidak valid', 400);
        }
        $this->assertUuid($id, 'Data tidak valid');
        $notification = UserNotification::whereKey($id)
            ->where('user_id', $request->attributes->get('auth_user_id'))
            ->first() ?? throw new ApiException('Notifikasi tidak ditemukan', 404);
        if (! $notification->read_at) {
            $notification->update(['read_at' => now()]);
        }

        return response()->json(['data' => $notification->refresh()]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        if ($request->all() !== []) {
            throw new ApiException('Data tidak valid', 400);
        }
        UserNotification::where('user_id', $request->attributes->get('auth_user_id'))
            ->whereNull('read_at')
            ->update(['read_at' => now(), 'updated_at' => now()]);

        return response()->json(['data' => ['message' => 'Semua notifikasi ditandai sudah dibaca']]);
    }
}
