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
            $table->string('username', 50)->unique();
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

    public function test_managed_users_require_authentication_and_administrator_role(): void
    {
        $this->getJson('/api/v1/users')->assertUnauthorized();

        $this->withToken($this->token(Role::PEMOHON))
            ->getJson('/api/v1/users')
            ->assertForbidden();

        $this->withToken($this->token(Role::PJ_RUANGAN))
            ->getJson('/api/v1/users')
            ->assertForbidden();
    }

    public function test_kasubag_has_the_same_administration_rights_as_kabag(): void
    {
        $this->withToken($this->token(Role::KASUBAG_UMUM))->getJson('/api/v1/users')->assertOk();
        $this->withToken($this->token(Role::KASUBAG_UMUM))->getJson('/api/v1/department-heads')->assertOk();
        $this->withToken($this->token(Role::KASUBAG_UMUM))->getJson('/api/v1/room-managers')->assertOk();
    }

    public function test_kabag_can_crud_room_manager_and_role_is_fixed_by_endpoint(): void
    {
        $token = $this->token(Role::KABAG_UMUM);

        $created = $this->withToken($token)->postJson('/api/v1/room-managers', [
            'fullName' => '  Petugas Ruangan  ',
            'username' => 'PETUGAS.RUANGAN',
            'email' => 'PETUGAS@EXAMPLE.TEST',
            'password' => 'SecurePass123!',
        ])->assertCreated()
            ->assertJsonPath('data.fullName', 'Petugas Ruangan')
            ->assertJsonPath('data.username', 'petugas.ruangan')
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
            'username' => 'injected.role',
            'email' => 'injected@example.test',
            'password' => 'SecurePass123!',
            'role' => Role::KABAG_UMUM->value,
        ])->assertBadRequest()->assertJsonPath('error.message', 'Data tidak valid');

        $this->withToken($token)->putJson('/api/v1/users/not-a-uuid', [
            'fullName' => 'Nama Baru',
        ])->assertBadRequest()->assertJsonPath('error.message', 'ID pengguna tidak valid');
    }

    public function test_username_must_be_unique_and_well_formed(): void
    {
        $token = $this->token(Role::KABAG_UMUM);

        $this->withToken($token)->postJson('/api/v1/users', [
            'fullName' => 'Pengguna Satu',
            'username' => 'pengguna.satu',
            'email' => 'satu@example.test',
            'password' => 'SecurePass123!',
        ])->assertCreated();

        $this->withToken($token)->postJson('/api/v1/users', [
            'fullName' => 'Pengguna Dua',
            'username' => 'PENGGUNA.SATU',
            'email' => 'dua@example.test',
            'password' => 'SecurePass123!',
        ])->assertConflict()->assertJsonPath('error.message', 'Username sudah digunakan');

        $this->withToken($token)->postJson('/api/v1/users', [
            'fullName' => 'Pengguna Tiga',
            'username' => 'spasi tidak boleh',
            'email' => 'tiga@example.test',
            'password' => 'SecurePass123!',
        ])->assertBadRequest();
    }

    public function test_department_heads_endpoint_manages_both_administrator_roles(): void
    {
        $actor = User::create([
            'full_name' => 'Kabag Aktif',
            'username' => 'kabag.aktif',
            'email' => 'kabag.aktif@example.test',
            'password_hash' => Hash::make('SecurePass123!'),
            'role' => Role::KABAG_UMUM,
        ]);
        $token = app(JwtService::class)->access($actor->id, Role::KABAG_UMUM);

        $this->getJson('/api/v1/department-heads')->assertUnauthorized();
        $this->withToken($this->token(Role::PEMOHON))->getJson('/api/v1/department-heads')->assertForbidden();

        // Non-administrator roles cannot be created through this endpoint.
        $this->withToken($token)->postJson('/api/v1/department-heads', [
            'fullName' => 'Role Injection',
            'username' => 'role.injection',
            'email' => 'injection.kabag@example.test',
            'password' => 'SecurePass123!',
            'role' => Role::PEMOHON->value,
        ])->assertBadRequest();

        $kabag = $this->withToken($token)->postJson('/api/v1/department-heads', [
            'fullName' => '  Kabag Kedua  ',
            'username' => 'kabag.kedua',
            'email' => 'KABAG.KEDUA@EXAMPLE.TEST',
            'password' => 'SecurePass123!',
        ])->assertCreated()
            ->assertJsonPath('data.fullName', 'Kabag Kedua')
            ->assertJsonPath('data.email', 'kabag.kedua@example.test')
            ->assertJsonPath('data.role', Role::KABAG_UMUM->value)
            ->json('data');

        $kasubag = $this->withToken($token)->postJson('/api/v1/department-heads', [
            'fullName' => 'Kasubag Umum',
            'username' => 'kasubag.umum',
            'email' => 'kasubag@example.test',
            'password' => 'SecurePass123!',
            'role' => Role::KASUBAG_UMUM->value,
        ])->assertCreated()
            ->assertJsonPath('data.role', Role::KASUBAG_UMUM->value)
            ->json('data');

        $kabagToken = app(JwtService::class)->access($kabag['id'], Role::KABAG_UMUM);
        $this->withToken($kabagToken)->putJson('/api/v1/department-heads/'.$kabag['id'], [
            'fullName' => 'Kabag Umum Kedua',
        ])->assertOk()
            ->assertJsonPath('data.fullName', 'Kabag Umum Kedua')
            ->assertJsonPath('data.role', Role::KABAG_UMUM->value);

        $this->withToken($token)->getJson('/api/v1/department-heads')->assertOk()->assertJsonCount(3, 'data');

        $this->withToken($token)->deleteJson('/api/v1/department-heads/'.$actor->id)
            ->assertConflict()
            ->assertJsonPath('error.message', 'Akun sendiri tidak dapat dihapus');
        $this->withToken($token)->deleteJson('/api/v1/department-heads/'.$kabag['id'])->assertForbidden();
        $this->withToken($token)->deleteJson('/api/v1/department-heads/'.$kasubag['id'])->assertOk();

        $this->assertDatabaseHas('users', ['id' => $actor->id]);
        $this->assertDatabaseHas('users', ['id' => $kabag['id']]);
        $this->assertDatabaseMissing('users', ['id' => $kasubag['id']]);
    }

    public function test_kasubag_can_create_only_the_first_kabag_and_cannot_manage_it_afterward(): void
    {
        $kasubag = User::create([
            'full_name' => 'Kasubag Pembuat',
            'username' => 'kasubag.pembuat',
            'email' => 'kasubag.pembuat@example.test',
            'password_hash' => Hash::make('SecurePass123!'),
            'role' => Role::KASUBAG_UMUM,
        ]);
        $token = app(JwtService::class)->access($kasubag->id, Role::KASUBAG_UMUM);

        $kabag = $this->withToken($token)->postJson('/api/v1/department-heads', [
            'fullName' => 'Kabag Pertama',
            'username' => 'kabag.pertama',
            'email' => 'kabag.pertama@example.test',
            'password' => 'SecurePass123!',
            'role' => Role::KABAG_UMUM->value,
        ])->assertCreated()->json('data');

        $this->withToken($token)->postJson('/api/v1/department-heads', [
            'fullName' => 'Kabag Kedua',
            'username' => 'kabag.kedua.lagi',
            'email' => 'kabag.kedua.lagi@example.test',
            'password' => 'SecurePass123!',
            'role' => Role::KABAG_UMUM->value,
        ])->assertForbidden()->assertJsonPath('error.message', 'Kasubag hanya dapat membuat akun Kabag pertama');

        $this->withToken($token)->putJson('/api/v1/department-heads/'.$kabag['id'], [
            'fullName' => 'Kabag Diubah Kasubag',
        ])->assertForbidden()->assertJsonPath('error.message', 'Akun Kabag hanya dapat diubah oleh pemilik akun');

        $this->withToken($token)->deleteJson('/api/v1/department-heads/'.$kabag['id'])
            ->assertForbidden()->assertJsonPath('error.message', 'Akun Kabag hanya dapat diubah oleh pemilik akun');

        $this->assertDatabaseHas('users', ['id' => $kabag['id'], 'full_name' => 'Kabag Pertama']);
    }

    public function test_kabag_account_can_update_its_own_data(): void
    {
        $kabag = User::create([
            'full_name' => 'Kabag Mandiri',
            'username' => 'kabag.mandiri',
            'email' => 'kabag.mandiri@example.test',
            'password_hash' => Hash::make('SecurePass123!'),
            'role' => Role::KABAG_UMUM,
        ]);
        $token = app(JwtService::class)->access($kabag->id, Role::KABAG_UMUM);

        $this->withToken($token)->putJson('/api/v1/department-heads/'.$kabag->id, [
            'fullName' => 'Kabag Mandiri Baru',
        ])->assertOk()->assertJsonPath('data.fullName', 'Kabag Mandiri Baru');
    }

    public function test_own_role_cannot_be_changed_and_last_administrator_cannot_be_deleted(): void
    {
        $actor = User::create([
            'full_name' => 'Kabag Tunggal',
            'username' => 'kabag.tunggal',
            'email' => 'tunggal@example.test',
            'password_hash' => Hash::make('SecurePass123!'),
            'role' => Role::KABAG_UMUM,
        ]);
        $token = app(JwtService::class)->access($actor->id, Role::KABAG_UMUM);

        $this->withToken($token)->putJson('/api/v1/department-heads/'.$actor->id, [
            'role' => Role::KASUBAG_UMUM->value,
        ])->assertConflict()->assertJsonPath('error.message', 'Role akun sendiri tidak dapat diubah');

        $other = User::create([
            'full_name' => 'Kasubag Lain',
            'username' => 'kasubag.lain',
            'email' => 'lain@example.test',
            'password_hash' => Hash::make('SecurePass123!'),
            'role' => Role::KASUBAG_UMUM,
        ]);
        $otherToken = app(JwtService::class)->access($other->id, Role::KASUBAG_UMUM);

        $this->withToken($otherToken)->deleteJson('/api/v1/department-heads/'.$actor->id)
            ->assertForbidden()
            ->assertJsonPath('error.message', 'Akun Kabag hanya dapat diubah oleh pemilik akun');
        $this->assertDatabaseHas('users', ['id' => $actor->id]);

        $this->withToken($otherToken)->deleteJson('/api/v1/department-heads/'.$other->id)
            ->assertConflict()
            ->assertJsonPath('error.message', 'Akun sendiri tidak dapat dihapus');
    }

    public function test_user_with_booking_history_cannot_be_deleted(): void
    {
        $user = User::create([
            'full_name' => 'User Bersejarah',
            'username' => 'user.bersejarah',
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
