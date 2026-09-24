<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\Role;
use App\Exceptions\ApiException;
use App\Http\Requests\AttentionMessageRequest;
use App\Services\AttentionMessageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class AttentionMessageController extends Controller
{
    public function __construct(private readonly AttentionMessageService $messages) {}

    /** Active notices addressed to the signed-in role; read on every login. */
    public function feed(Request $request): JsonResponse
    {
        $role = $request->attributes->get('auth_role');
        if (! $role instanceof Role) {
            throw new ApiException('Autentikasi diperlukan', 401);
        }

        return response()->json(['data' => $this->messages->feed($role)]);
    }

    /** Public: the sign-in page reads these before anyone has authenticated. */
    public function publicFeed(): JsonResponse
    {
        return response()->json(['data' => $this->messages->publicFeed()]);
    }

    public function index(): JsonResponse
    {
        return response()->json(['data' => $this->messages->all()]);
    }

    public function store(AttentionMessageRequest $request): JsonResponse
    {
        return response()->json(['data' => $this->messages->create(
            $request->validated(),
            $request->attributes->get('auth_user_id'),
        )], 201);
    }

    public function update(AttentionMessageRequest $request, string $id): JsonResponse
    {
        $this->assertUuid($id, 'ID informasi tidak valid');

        return response()->json(['data' => $this->messages->update($id, $request->validated())]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        if ($request->all() !== []) {
            throw new ApiException('Data tidak valid', 400, ['body' => ['Request tidak boleh memiliki data']]);
        }
        $this->assertUuid($id, 'ID informasi tidak valid');
        $this->messages->delete($id);

        return response()->json(['data' => ['message' => 'Informasi berhasil dihapus']]);
    }
}
