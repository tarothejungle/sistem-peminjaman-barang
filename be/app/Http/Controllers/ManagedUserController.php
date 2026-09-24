<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\Role;
use App\Exceptions\ApiException;
use App\Http\Requests\ManagedUserRequest;
use App\Models\PasswordResetToken;
use App\Models\User;
use App\Services\AuthSessionService;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

final class ManagedUserController extends Controller
{
    public function __construct(private readonly AuthSessionService $sessions) {}

    public function roomManagers(): JsonResponse
    {
        return $this->index([Role::PJ_RUANGAN]);
    }

    public function users(): JsonResponse
    {
        return $this->index([Role::PEMOHON]);
    }

    /**
     * "Data Kabag & Kasubag" manages both administrator roles in one screen.
     */
    public function departmentHeads(): JsonResponse
    {
        return $this->index(Role::administrators());
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
        $role = $this->administratorRole($request);
        $this->assertCanCreateDepartmentHead($request, $role);

        return $this->store($request, $role);
    }

    public function updateRoomManager(ManagedUserRequest $request, string $id): JsonResponse
    {
        return $this->update($request, $id, [Role::PJ_RUANGAN]);
    }

    public function updateUser(ManagedUserRequest $request, string $id): JsonResponse
    {
        return $this->update($request, $id, [Role::PEMOHON]);
    }

    public function updateDepartmentHead(ManagedUserRequest $request, string $id): JsonResponse
    {
        $user = $this->find($id, Role::administrators());
        $newRole = $this->administratorRole($request, optional: true);
        $this->assertCanManageDepartmentHead($request, $user, $newRole);

        return $this->update($request, $id, Role::administrators(), $newRole);
    }

    public function destroyRoomManager(Request $request, string $id): JsonResponse
    {
        return $this->destroy($request, $id, [Role::PJ_RUANGAN]);
    }

    public function destroyUser(Request $request, string $id): JsonResponse
    {
        return $this->destroy($request, $id, [Role::PEMOHON]);
    }

    public function destroyDepartmentHead(Request $request, string $id): JsonResponse
    {
        $user = $this->find($id, Role::administrators());
        $this->assertCanManageDepartmentHead($request, $user, null);

        return $this->destroy($request, $id, Role::administrators());
    }

    /**
     * @param  list<Role>  $roles
     */
    private function index(array $roles): JsonResponse
    {
        $users = User::query()
            ->whereIn('role', array_map(static fn (Role $role): string => $role->value, $roles))
            ->orderBy('full_name')
            ->get();

        return response()->json(['data' => $users]);
    }

    private function store(ManagedUserRequest $request, Role $role): JsonResponse
    {
        $data = $request->validated();

        try {
            $user = User::create([
                'full_name' => trim($data['fullName']),
                'username' => strtolower(trim($data['username'])),
                'email' => strtolower($data['email']),
                'password_hash' => Hash::make($data['password']),
                'role' => $role,
            ]);
        } catch (QueryException $exception) {
            $this->handleQueryException($exception);
        }

        return response()->json(['data' => $user], 201);
    }

    /**
     * @param  list<Role>  $allowedRoles
     */
    private function update(ManagedUserRequest $request, string $id, array $allowedRoles, ?Role $newRole = null): JsonResponse
    {
        $user = $this->find($id, $allowedRoles);
        $data = $request->validated();
        $attributes = [];

        if (array_key_exists('fullName', $data)) {
            $attributes['full_name'] = trim($data['fullName']);
        }
        if (array_key_exists('username', $data)) {
            $attributes['username'] = strtolower(trim($data['username']));
        }
        if (array_key_exists('email', $data)) {
            $attributes['email'] = strtolower($data['email']);
        }
        $passwordChanged = false;
        if (array_key_exists('password', $data)) {
            $attributes['password_hash'] = Hash::make($data['password']);
            $passwordChanged = true;
        }
        if ($newRole !== null) {
            $this->assertNotSelfDemotion($request, $user, $newRole);
            $attributes['role'] = $newRole;
        }

        try {
            DB::transaction(function () use ($user, $attributes, $passwordChanged): void {
                $user->update($attributes);
                if ($passwordChanged) {
                    $this->sessions->revokeAllForUser($user->id);
                    PasswordResetToken::query()->where('user_id', $user->id)->whereNull('used_at')->update(['used_at' => now()]);
                }
            });
        } catch (QueryException $exception) {
            $this->handleQueryException($exception);
        }

        return response()->json(['data' => $user->refresh()]);
    }

    /**
     * @param  list<Role>  $allowedRoles
     */
    private function destroy(Request $request, string $id, array $allowedRoles): JsonResponse
    {
        $user = $this->find($id, $allowedRoles);
        if ($user->id === $request->attributes->get('auth_user_id')) {
            throw new ApiException('Akun sendiri tidak dapat dihapus', 409);
        }
        if ($user->bookings()->exists()) {
            throw new ApiException('Pengguna yang memiliki riwayat peminjaman tidak dapat dihapus', 409);
        }

        $user->delete();

        return response()->json(['data' => ['id' => $user->id]]);
    }

    /**
     * @param  list<Role>  $allowedRoles
     */
    private function find(string $id, array $allowedRoles): User
    {
        $this->assertUuid($id, 'ID pengguna tidak valid');

        return User::query()
            ->whereIn('role', array_map(static fn (Role $role): string => $role->value, $allowedRoles))
            ->find($id) ?? throw new ApiException('Pengguna tidak ditemukan', 404);
    }

    /**
     * Resolves the administrator role for the "Data Kabag & Kasubag" endpoints.
     * Defaults to KABAG_UMUM so existing clients keep working.
     */
    private function administratorRole(ManagedUserRequest $request, bool $optional = false): ?Role
    {
        $value = $request->validated()['role'] ?? null;
        if ($value === null) {
            return $optional ? null : Role::KABAG_UMUM;
        }

        $role = Role::tryFrom($value);
        if ($role === null || ! $role->isAdministrator()) {
            throw new ApiException('Role tidak valid untuk menu Kabag & Kasubag', 422);
        }

        return $role;
    }

    private function assertCanCreateDepartmentHead(Request $request, Role $role): void
    {
        if ($request->attributes->get('auth_role') !== Role::KASUBAG_UMUM || $role !== Role::KABAG_UMUM) {
            return;
        }
        if (! User::query()->where('role', Role::KABAG_UMUM->value)->exists()) {
            return;
        }

        throw new ApiException('Kasubag hanya dapat membuat akun Kabag pertama', 403);
    }

    private function assertCanManageDepartmentHead(Request $request, User $user, ?Role $newRole): void
    {
        $actorRole = $request->attributes->get('auth_role');
        $actorId = $request->attributes->get('auth_user_id');

        if ($user->role === Role::KABAG_UMUM && $user->id !== $actorId) {
            throw new ApiException('Akun Kabag hanya dapat diubah oleh pemilik akun', 403);
        }
        if ($actorRole === Role::KASUBAG_UMUM && $newRole === Role::KABAG_UMUM) {
            throw new ApiException('Kasubag tidak dapat mengubah akun menjadi Kabag', 403);
        }
    }

    /**
     * Prevents an administrator from removing their own administrative rights and
     * locking the system out of user management.
     */
    private function assertNotSelfDemotion(Request $request, User $user, Role $newRole): void
    {
        if ($user->id !== $request->attributes->get('auth_user_id')) {
            return;
        }
        if ($user->role === $newRole) {
            return;
        }

        throw new ApiException('Role akun sendiri tidak dapat diubah', 409);
    }

    /**
     * Keeps at least one administrator account so the system stays manageable.
     *
     * The self-deletion guard already covers this: the actor must be an
     * administrator to reach these endpoints and cannot delete their own
     * account, so at least one administrator always survives.
     */
    private function handleQueryException(QueryException $exception): never
    {
        if ($this->isUniqueViolation($exception)) {
            throw new ApiException(
                str_contains(strtolower($exception->getMessage()), 'username')
                    ? 'Username sudah digunakan'
                    : 'Email sudah terdaftar',
                409,
            );
        }

        throw $exception;
    }

    private function isUniqueViolation(QueryException $exception): bool
    {
        // 23505 = PostgreSQL unique_violation; SQLite reports 23000 with a message.
        return in_array($exception->getCode(), ['23505', '23000'], true);
    }
}
