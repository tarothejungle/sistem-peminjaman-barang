<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\User;
use App\Services\JwtService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

final class ManagedUserCrudTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('users', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('full_name', 100);
            $table->string('email')->unique();
            $table->string('password_hash');
            $table->string('role');
            $table->timestamps();
        });
        Schema::create('bookings', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
        });
    }

    public function test_managed_users_require_authentication_and_kabag_role(): void
    {
        $this->getJson('/api/v1/users')->assertUnauthorized();

        $this->withToken($this->token(Role::PEMOHON))
            ->getJson('/api/v1/users')
            ->assertForbidden();
    }

    public function test_kabag_can_crud_room_manager_and_role_is_fixed_by_endpoint(): void
    {
        $token = $this->token(Role::KABAG_UMUM);

        $created = $this->withToken($token)->postJson('/api/v1/room-managers', [
            'fullName' => '  Petugas Ruangan  ',
            'email' => 'PETUGAS@EXAMPLE.TEST',
            'password' => 'SecurePass123!',
        ])->assertCreated()
            ->assertJsonPath('data.fullName', 'Petugas Ruangan')
            ->assertJsonPath('data.email', 'petugas@example.test')
            ->assertJsonPath('data.role', Role::PJ_RUANGAN->value)
            ->json('data');

        $this->withToken($token)->putJson('/api/v1/room-managers/'.$created['id'], [
            'fullName' => 'Petugas Baru',
            'email' => 'baru@example.test',
        ])->assertOk()->assertJsonPath('data.fullName', 'Petugas Baru');

        $this->withToken($token)->getJson('/api/v1/room-managers')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.role', Role::PJ_RUANGAN->value);

        $this->withToken($token)->deleteJson('/api/v1/room-managers/'.$created['id'])
            ->assertOk()
            ->assertJsonPath('data.id', $created['id']);

        $this->assertDatabaseMissing('users', ['id' => $created['id']]);
    }

    public function test_create_rejects_role_injection_and_invalid_id(): void
    {
        $token = $this->token(Role::KABAG_UMUM);

        $this->withToken($token)->postJson('/api/v1/users', [
            'fullName' => 'Injected Role',
            'email' => 'injected@example.test',
            'password' => 'SecurePass123!',
            'role' => Role::KABAG_UMUM->value,
        ])->assertBadRequest()->assertJsonPath('error.message', 'Data tidak valid');

        $this->withToken($token)->putJson('/api/v1/users/not-a-uuid', [
            'fullName' => 'Nama Baru',
        ])->assertBadRequest()->assertJsonPath('error.message', 'ID pengguna tidak valid');
    }

    public function test_kabag_can_crud_other_kabag_but_cannot_delete_own_account(): void
    {
        $actor = User::create([
            'full_name' => 'Kabag Aktif',
            'email' => 'kabag.aktif@example.test',
            'password_hash' => Hash::make('SecurePass123!'),
            'role' => Role::KABAG_UMUM,
        ]);
        $token = app(JwtService::class)->access($actor->id, Role::KABAG_UMUM);

        $this->getJson('/api/v1/department-heads')->assertUnauthorized();
        $this->withToken($this->token(Role::PEMOHON))->getJson('/api/v1/department-heads')->assertForbidden();
        $this->withToken($token)->postJson('/api/v1/department-heads', [
            'fullName' => 'Role Injection',
            'email' => 'injection.kabag@example.test',
            'password' => 'SecurePass123!',
            'role' => Role::PEMOHON->value,
        ])->assertBadRequest();

        $created = $this->withToken($token)->postJson('/api/v1/department-heads', [
            'fullName' => '  Kabag Kedua  ',
            'email' => 'KABAG.KEDUA@EXAMPLE.TEST',
            'password' => 'SecurePass123!',
        ])->assertCreated()
            ->assertJsonPath('data.fullName', 'Kabag Kedua')
            ->assertJsonPath('data.email', 'kabag.kedua@example.test')
            ->assertJsonPath('data.role', Role::KABAG_UMUM->value)
            ->json('data');

        $this->withToken($token)->putJson('/api/v1/department-heads/'.$created['id'], ['fullName' => 'Kabag Umum Kedua'])
            ->assertOk()
            ->assertJsonPath('data.fullName', 'Kabag Umum Kedua');
        $this->withToken($token)->getJson('/api/v1/department-heads')->assertOk()->assertJsonCount(2, 'data');
        $this->withToken($token)->deleteJson('/api/v1/department-heads/'.$actor->id)
            ->assertConflict()
            ->assertJsonPath('error.message', 'Akun sendiri tidak dapat dihapus');
        $this->withToken($token)->deleteJson('/api/v1/department-heads/'.$created['id'])
            ->assertOk()
            ->assertJsonPath('data.id', $created['id']);

        $this->assertDatabaseHas('users', ['id' => $actor->id]);
        $this->assertDatabaseMissing('users', ['id' => $created['id']]);
    }

    public function test_user_with_booking_history_cannot_be_deleted(): void
    {
        $user = User::create([
            'full_name' => 'User Bersejarah',
            'email' => 'history@example.test',
            'password_hash' => Hash::make('SecurePass123!'),
            'role' => Role::PEMOHON,
        ]);
        DB::table('bookings')->insert(['id' => fake()->uuid(), 'user_id' => $user->id]);

        $this->withToken($this->token(Role::KABAG_UMUM))
            ->deleteJson('/api/v1/users/'.$user->id)
            ->assertConflict()
            ->assertJsonPath('error.message', 'Pengguna yang memiliki riwayat peminjaman tidak dapat dihapus');

        $this->assertDatabaseHas('users', ['id' => $user->id]);
    }

    private function token(Role $role): string
    {
        return app(JwtService::class)->access(fake()->uuid(), $role);
    }
}
