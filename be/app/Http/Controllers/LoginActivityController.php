<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\LoginActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class LoginActivityController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'page' => ['sometimes', 'integer', 'min:1'],
            'perPage' => ['sometimes', 'integer', 'min:1', 'max:50'],
        ]);
        $perPage = (int) ($validated['perPage'] ?? 10);
        $cutoff = now()->subDay();
        $baseQuery = LoginActivity::query()->where('logged_in_at', '>=', $cutoff);
        $activities = (clone $baseQuery)
            ->with(['user:id,full_name,username,role', 'authSession:id,last_activity_at,expires_at,revoked_at'])
            ->latest('logged_in_at')
            ->paginate($perPage);
        $inactivityTtl = (int) config('jwt.inactivity_ttl');

        return response()->json(['data' => [
            'summary' => [
                'loginCount' => (clone $baseQuery)->count(),
                'uniqueUserCount' => (clone $baseQuery)->distinct('user_id')->count('user_id'),
                'activeSessionCount' => (clone $baseQuery)
                    ->whereHas('authSession', fn ($query) => $query
                        ->whereNull('revoked_at')
                        ->where('expires_at', '>', now())
                        ->where('last_activity_at', '>', now()->subSeconds($inactivityTtl)))
                    ->count(),
            ],
            'activities' => $activities->getCollection()->map(function (LoginActivity $activity) use ($inactivityTtl): array {
                $session = $activity->authSession;
                $isActive = $session !== null
                    && $session->revoked_at === null
                    && $session->expires_at->isFuture()
                    && $session->last_activity_at->addSeconds($inactivityTtl)->isFuture();

                return [
                    'id' => $activity->id,
                    'user' => $activity->user,
                    'loggedInAt' => $activity->logged_in_at,
                    'lastActivityAt' => $session?->last_activity_at,
                    'status' => $isActive ? 'ACTIVE' : 'ENDED',
                ];
            })->values(),
            'pagination' => [
                'currentPage' => $activities->currentPage(),
                'lastPage' => $activities->lastPage(),
                'perPage' => $activities->perPage(),
                'total' => $activities->total(),
            ],
        ]]);
    }
}
