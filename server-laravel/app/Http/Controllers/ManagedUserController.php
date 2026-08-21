<?php

namespace App\Http\Controllers;

use App\Enums\Role;
use App\Exceptions\ApiException;
use App\Http\Requests\ManagedUserRequest;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

final class ManagedUserController extends Controller
{
    public function roomManagers(): JsonResponse
    {
        return $this->index(Role::PJ_RUANGAN);
    }

    public function users(): JsonResponse
    {
        return $this->index(Role::PEMOHON);
    }

    public function departmentHeads(): JsonResponse
    {
        return $this->index(Role::KABAG_UMUM);
    }

    public function storeRoomManager(ManagedUserRequest $request): JsonResponse
    {
        return $this->store($request, Role::PJ_RUANGAN);
    }

    public function storeUser(ManagedUserRequest $request): JsonResponse
    {
        return $this->store($request, Role::PEMOHON);
    }

    public function storeDepartmentHead(ManagedUserRequest $request): JsonResponse
    {
        return $this->store($request, Role::KABAG_UMUM);
    }

    public function updateRoomManager(ManagedUserRequest $request, string $id): JsonResponse
    {
        return $this->update($request, $id, Role::PJ_RUANGAN);
    }

    public function updateUser(ManagedUserRequest $request, string $id): JsonResponse
    {
        return $this->update($request, $id, Role::PEMOHON);
    }

    public function updateDepartmentHead(ManagedUserRequest $request, string $id): JsonResponse
    {
        return $this->update($request, $id, Role::KABAG_UMUM);
    }

    public function destroyRoomManager(Request $request, string $id): JsonResponse
    {
        return $this->destroy($request, $id, Role::PJ_RUANGAN);
    }

    public function destroyUser(Request $request, string $id): JsonResponse
    {
        return $this->destroy($request, $id, Role::PEMOHON);
    }

    public function destroyDepartmentHead(Request $request, string $id): JsonResponse
    {
        return $this->destroy($request, $id, Role::KABAG_UMUM);
    }

    private function index(Role $role): JsonResponse
    {
        return response()->json(['data' => User::where('role', $role)->orderBy('full_name')->get()]);
    }

    private function store(ManagedUserRequest $request, Role $role): JsonResponse
    {
        $data = $request->validated();

        try {
            $user = User::create([
                'full_name' => trim($data['fullName']),
                'email' => strtolower($data['email']),
                'password_hash' => Hash::make($data['password']),
                'role' => $role,
            ]);
        } catch (QueryException $exception) {
            $this->handleQueryException($exception);
        }

        return response()->json(['data' => $user], 201);
    }

    private function update(ManagedUserRequest $request, string $id, Role $role): JsonResponse
    {
        $user = $this->find($id, $role);
        $data = $request->validated();
        $attributes = [];

        if (array_key_exists('fullName', $data)) {
            $attributes['full_name'] = trim($data['fullName']);
        }
        if (array_key_exists('email', $data)) {
            $attributes['email'] = strtolower($data['email']);
        }
        if (array_key_exists('password', $data)) {
            $attributes['password_hash'] = Hash::make($data['password']);
        }

        try {
            $user->update($attributes);
        } catch (QueryException $exception) {
            $this->handleQueryException($exception);
        }

        return response()->json(['data' => $user->refresh()]);
    }

    private function destroy(Request $request, string $id, Role $role): JsonResponse
    {
        $user = $this->find($id, $role);
        if ($user->id === $request->attributes->get('auth_user_id')) {
            throw new ApiException('Akun sendiri tidak dapat dihapus', 409);
        }
        if ($user->bookings()->exists()) {
            throw new ApiException('Pengguna yang memiliki riwayat peminjaman tidak dapat dihapus', 409);
        }

        $user->delete();

        return response()->json(['data' => ['id' => $user->id]]);
    }

    private function find(string $id, Role $role): User
    {
        if (! preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $id)) {
            throw new ApiException('ID pengguna tidak valid', 400);
        }

        return User::where('role', $role)->find($id) ?? throw new ApiException('Pengguna tidak ditemukan', 404);
    }

    private function handleQueryException(QueryException $exception): never
    {
        if ($exception->getCode() === '23505') {
            throw new ApiException('Email sudah terdaftar', 409);
        }

        throw $exception;
    }
}
