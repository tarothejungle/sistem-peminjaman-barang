<?php

namespace Tests\Feature;

use App\Enums\BookingStatus;
use App\Enums\ResourceType;
use App\Enums\Role;
use App\Services\JwtService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\IOFactory;
use Tests\TestCase;

/**
 * Covers the vehicle plate column on inventory rows and both "Laporan Peminjaman"
 * exports (.xlsx / .pdf) that the kelola panel offers.
 */
final class VehiclePlateAndReportExportTest extends TestCase
{
    private string $kasubagId;

    private string $pjId;

    private string $pemohonId;

    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('users', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('full_name');
            $table->string('role');
            $table->string('phone_number', 20)->nullable();
            $table->integer('credit_score')->default(100);
            $table->timestamps();
        });
        $this->kasubagId = (string) Str::uuid();
        $this->pjId = (string) Str::uuid();
        $this->pemohonId = (string) Str::uuid();
        DB::table('users')->insert([
            ['id' => $this->kasubagId, 'full_name' => 'Kasubag Umum', 'role' => Role::KASUBAG_UMUM->value],
            ['id' => $this->pjId, 'full_name' => 'PJ Ruangan', 'role' => Role::PJ_RUANGAN->value],
            ['id' => $this->pemohonId, 'full_name' => 'Pemohon Satu', 'role' => Role::PEMOHON->value],
        ]);

        Schema::create('rooms', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->unsignedInteger('capacity')->default(10);
            $table->string('location')->default('Lantai 1');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
        Schema::create('items', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->unsignedInteger('total_stock');
            $table->string('category');
            $table->string('plate_number', 20)->nullable();
            $table->boolean('is_active')->default(true);
            $table->string('image_path')->nullable();
            $table->string('image_mime')->nullable();
            $table->timestamps();
        });
        Schema::create('bookings', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->string('resource_type');
            $table->uuid('room_id')->nullable();
            $table->string('responsible_name')->nullable();
            $table->string('phone_number')->nullable();
            $table->string('work_unit')->nullable();
            $table->dateTime('start_time');
            $table->dateTime('end_time');
            $table->text('purpose');
            $table->string('status');
            $table->dateTime('returned_at')->nullable();
            $table->uuid('alternative_room_id')->nullable();
            $table->dateTime('alternative_start_time')->nullable();
            $table->dateTime('alternative_end_time')->nullable();
            $table->text('approval_notes')->nullable();
            $table->text('inspection_notes')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->string('document_disk')->nullable();
            $table->string('document_path')->nullable();
            $table->string('document_original_name')->nullable();
            $table->string('document_mime')->nullable();
            $table->unsignedBigInteger('document_size')->nullable();
            $table->timestamps();
        });
        Schema::create('booking_items', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('booking_id');
            $table->uuid('item_id');
            $table->unsignedInteger('quantity');
        });
        Schema::create('user_credit_events', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->uuid('booking_id')->nullable()->unique();
            $table->integer('delta');
            $table->integer('score_after');
            $table->string('reason');
            $table->timestamps();
        });
        Schema::create('room_booking_settings', function (Blueprint $table): void {
            $table->unsignedSmallInteger('id')->primary();
            $table->time('start_time');
            $table->time('end_time');
            $table->time('morning_start_time');
            $table->time('morning_end_time');
            $table->time('afternoon_start_time');
            $table->time('afternoon_end_time');
            $table->string('timezone');
            $table->uuid('updated_by')->nullable();
            $table->timestamps();
        });
    }

    public function test_kasubag_can_store_a_vehicle_plate_and_it_is_normalised(): void
    {
        $created = $this->withToken($this->token(Role::KASUBAG_UMUM, $this->kasubagId))->postJson('/api/v1/items', [
            'name' => 'Toyota Avanza',
            'category' => 'Kendaraan - Mobil',
            'totalStock' => 2,
            'plateNumber' => ' b 1234 xyz ',
        ])->assertCreated();

        $created->assertJsonPath('data.plateNumber', 'B 1234 XYZ');
        $itemId = $created->json('data.id');
        $this->assertDatabaseHas('items', ['id' => $itemId, 'plate_number' => 'B 1234 XYZ']);

        $this->withToken($this->token(Role::KASUBAG_UMUM, $this->kasubagId))->postJson("/api/v1/items/{$itemId}", [
            'plateNumber' => 'D 9999 ab',
        ])->assertOk()->assertJsonPath('data.plateNumber', 'D 9999 AB');

        $this->withToken($this->token(Role::KASUBAG_UMUM, $this->kasubagId))->getJson('/api/v1/items')
            ->assertOk()
            ->assertJsonPath('data.0.plateNumber', 'D 9999 AB');
    }

    public function test_vehicle_plate_is_optional_and_bounded(): void
    {
        $token = $this->token(Role::PJ_RUANGAN, $this->pjId);

        $this->withToken($token)->postJson('/api/v1/items', [
            'name' => 'Proyektor',
            'category' => 'Elektronik',
            'totalStock' => 1,
        ])->assertCreated()->assertJsonPath('data.plateNumber', null);

        $this->withToken($token)->postJson('/api/v1/items', [
            'name' => 'Mobil Dinas',
            'category' => 'Kendaraan',
            'totalStock' => 1,
            'plateNumber' => str_repeat('A', 21),
        ])->assertBadRequest();
    }

    public function test_blank_vehicle_plate_clears_the_stored_value(): void
    {
        $token = $this->token(Role::KASUBAG_UMUM, $this->kasubagId);

        $created = $this->withToken($token)->postJson('/api/v1/items', [
            'name' => 'Isuzu Elf',
            'category' => 'Kendaraan - Truk',
            'totalStock' => 1,
            'plateNumber' => 'B 5555 ELF',
        ])->assertCreated();

        $itemId = $created->json('data.id');

        $this->withToken($token)->postJson("/api/v1/items/{$itemId}", ['plateNumber' => ''])
            ->assertOk()
            ->assertJsonPath('data.plateNumber', null);

        $this->assertDatabaseHas('items', ['id' => $itemId, 'plate_number' => null]);
    }

    public function test_report_export_requires_an_authorised_role(): void
    {
        $this->getJson('/api/v1/reports/bookings/xlsx')->assertUnauthorized();

        $this->withToken($this->token(Role::PEMOHON, $this->pemohonId))
            ->getJson('/api/v1/reports/bookings/xlsx')
            ->assertForbidden();

        $this->withToken($this->token(Role::PJ_RUANGAN, $this->pjId))
            ->getJson('/api/v1/reports/bookings/docx')
            ->assertNotFound();
    }

    public function test_report_export_rejects_unknown_query_parameters(): void
    {
        $this->withToken($this->token(Role::KASUBAG_UMUM, $this->kasubagId))
            ->getJson('/api/v1/reports/bookings/xlsx?unexpected=1')
            ->assertBadRequest();
    }

    public function test_report_export_produces_a_real_xlsx_and_pdf(): void
    {
        $this->seedBooking();
        $token = $this->token(Role::KASUBAG_UMUM, $this->kasubagId);

        $xlsx = $this->withToken($token)->get('/api/v1/reports/bookings/xlsx');
        $xlsx->assertOk()
            ->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        $this->assertStringStartsWith('PK', (string) $xlsx->getContent());
        $this->assertStringContainsString('attachment; filename="laporan-peminjaman-', (string) $xlsx->headers->get('content-disposition'));

        $pdf = $this->withToken($token)->get('/api/v1/reports/bookings/pdf');
        $pdf->assertOk()->assertHeader('content-type', 'application/pdf');
        $this->assertStringStartsWith('%PDF', (string) $pdf->getContent());

        $filtered = $this->withToken($token)->get('/api/v1/reports/bookings/pdf?status='.BookingStatus::APPROVED->value);
        $filtered->assertOk()->assertHeader('content-type', 'application/pdf');

        $this->withToken($token)->get('/api/v1/reports/bookings/xlsx?status=BUKAN_STATUS')->assertBadRequest();
    }

    /**
     * A borrower controls "Nama Peminjam", so a value starting with "=" must be
     * stored as text; otherwise the administrator who opens the export runs it
     * as a spreadsheet formula.
     */
    public function test_report_export_keeps_formula_like_values_as_text(): void
    {
        $payload = '=HYPERLINK("http://evil.test","klik")';
        $this->seedBooking($payload);
        $token = $this->token(Role::KASUBAG_UMUM, $this->kasubagId);

        $xlsx = $this->withToken($token)->get('/api/v1/reports/bookings/xlsx');
        $xlsx->assertOk();
        $this->assertStringStartsWith('PK', (string) $xlsx->getContent());

        $path = tempnam(sys_get_temp_dir(), 'laporan-test-').'.xlsx';
        file_put_contents($path, (string) $xlsx->getContent());

        try {
            // "Nama Peminjam" is the third column and body rows start at 5.
            $cell = IOFactory::load($path)->getActiveSheet()->getCell('C5');
            $this->assertSame(DataType::TYPE_STRING, $cell->getDataType());
            $this->assertSame($payload, $cell->getValue());
        } finally {
            unlink($path);
        }
    }

    private function seedBooking(string $responsibleName = 'Pemohon Satu'): void
    {
        $itemId = (string) Str::uuid();
        DB::table('items')->insert([
            'id' => $itemId,
            'name' => 'Toyota Avanza',
            'total_stock' => 2,
            'category' => 'Kendaraan - Mobil',
            'plate_number' => 'B 1234 XYZ',
            'is_active' => true,
        ]);

        $bookingId = (string) Str::uuid();
        DB::table('bookings')->insert([
            'id' => $bookingId,
            'user_id' => $this->pemohonId,
            'resource_type' => ResourceType::ITEM->value,
            'responsible_name' => $responsibleName,
            'phone_number' => '081234567890',
            'work_unit' => 'Biro Umum',
            'start_time' => now()->addDay(),
            'end_time' => now()->addDay()->addHours(4),
            'purpose' => 'Perjalanan dinas',
            'status' => BookingStatus::APPROVED->value,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('booking_items')->insert([
            'id' => (string) Str::uuid(),
            'booking_id' => $bookingId,
            'item_id' => $itemId,
            'quantity' => 1,
        ]);
    }

    private function token(Role $role, string $userId): string
    {
        return app(JwtService::class)->access($userId, $role);
    }
}
