<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\Role;
use App\Exceptions\ApiException;
use App\Models\AttentionMessage;
use Illuminate\Database\Eloquent\Collection;

/**
 * CRUD for the administrator-authored notices plus the per-role feed that the
 * post-login dialog reads.
 */
final class AttentionMessageService
{
    /** @return Collection<int, AttentionMessage> */
    public function feed(Role $role): Collection
    {
        return AttentionMessage::query()->visibleTo($role)
            ->orderBy('sort_order')
            ->orderBy('created_at')
            ->get();
    }

    /**
     * Notices for the sign-in page, read before anyone has authenticated.
     *
     * @return Collection<int, AttentionMessage>
     */
    public function publicFeed(): Collection
    {
        return AttentionMessage::query()->visibleBeforeLogin()
            ->orderBy('sort_order')
            ->orderBy('created_at')
            ->get();
    }

    /** @return Collection<int, AttentionMessage> */
    public function all(): Collection
    {
        return AttentionMessage::query()
            ->orderBy('sort_order')
            ->orderByDesc('created_at')
            ->get();
    }

    public function create(array $data, string $userId): AttentionMessage
    {
        return AttentionMessage::create([
            'title' => trim($data['title']),
            'message' => trim($data['message']),
            'audience_role' => $data['audienceRole'],
            'is_active' => $data['isActive'] ?? true,
            'placement' => $data['placement'] ?? AttentionMessage::PLACEMENT_AFTER_LOGIN,
            'sort_order' => $data['sortOrder'] ?? 0,
            'created_by' => $userId,
        ]);
    }

    public function update(string $id, array $data): AttentionMessage
    {
        $message = AttentionMessage::find($id) ?? throw new ApiException('Informasi tidak ditemukan', 404);
        $message->update(array_filter([
            'title' => isset($data['title']) ? trim($data['title']) : null,
            'message' => isset($data['message']) ? trim($data['message']) : null,
            'audience_role' => $data['audienceRole'] ?? null,
            'is_active' => $data['isActive'] ?? null,
            'placement' => $data['placement'] ?? null,
            'sort_order' => $data['sortOrder'] ?? null,
        ], fn ($value): bool => $value !== null));

        return $message->refresh();
    }

    public function delete(string $id): void
    {
        $message = AttentionMessage::find($id) ?? throw new ApiException('Informasi tidak ditemukan', 404);
        $message->delete();
    }
}
