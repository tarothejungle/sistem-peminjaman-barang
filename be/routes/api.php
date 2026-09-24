<?php

use App\Http\Controllers\AttentionMessageController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BookingController;
use App\Http\Controllers\BookingReportController;
use App\Http\Controllers\ItemController;
use App\Http\Controllers\LoginActivityController;
use App\Http\Controllers\MaintenanceSettingController;
use App\Http\Controllers\ManagedUserController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\RoomBookingCancellationController;
use App\Http\Controllers\RoomBookingSettingController;
use App\Http\Controllers\RoomController;
use App\Http\Controllers\UserProfileController;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

Route::get('/health', function () {
    try {
        DB::select('SELECT 1');
    } catch (Throwable) {
        return response()->json(['error' => ['message' => 'Database tidak terhubung. Periksa konfigurasi DB pada environment produksi.']], 503);
    }

    return response()->json(['data' => ['status' => 'ok']]);
});

Route::prefix('auth')->controller(AuthController::class)->group(function (): void {
    Route::get('/config', 'config');
    Route::post('/login', 'login')->middleware(['browser-origin', 'throttle:auth-login']);
    Route::post('/refresh', 'refresh')->middleware(['browser-origin', 'throttle:auth-refresh']);
    Route::post('/logout', 'logout')->middleware('browser-origin');
    Route::post('/forgot-password', 'forgotPassword')->middleware('throttle:auth-forgot-password');
    Route::post('/reset-password/verify', 'verifyResetToken')->middleware('throttle:auth-reset-password');
    Route::post('/reset-password', 'resetPassword')->middleware('throttle:auth-reset-password');
    Route::post('/activity', 'activity')->middleware('jwt');
    Route::get('/me', 'me')->middleware('jwt');
    Route::patch('/password', 'changePassword')->middleware(['jwt', 'throttle:auth-password']);
});

Route::get('/display/rooms', [BookingController::class, 'roomDisplay'])->middleware('throttle:60,1');

/** Public status so the frontend can render the maintenance notice itself. */
Route::get('/maintenance', [MaintenanceSettingController::class, 'show']);

/** Public notices shown on the sign-in page, before anyone authenticates. */
Route::get('/attention-messages/public', [AttentionMessageController::class, 'publicFeed']);

/** Kelola Ruangan / Kelola Kendaraan — administrators plus PJ Ruangan. */
$resourceManagers = 'role:KABAG_UMUM,KASUBAG_UMUM,PJ_RUANGAN';

Route::middleware('jwt')->group(function () use ($resourceManagers): void {
    Route::middleware('role:PEMOHON,PJ_RUANGAN,KABAG_UMUM,KASUBAG_UMUM')->controller(UserProfileController::class)->group(function (): void {
        Route::patch('/profile', 'update');
        Route::post('/profile/photo', 'uploadPhoto');
        Route::get('/profile/photo', 'photo');
        Route::delete('/profile/photo', 'deletePhoto');
    });

    Route::get('/reports/bookings/{format}', [BookingReportController::class, 'export'])
        ->whereIn('format', ['xlsx', 'pdf'])
        ->middleware('role:KABAG_UMUM,KASUBAG_UMUM,PJ_RUANGAN');

    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::patch('/notifications/read-all', [NotificationController::class, 'markAllRead']);
    Route::patch('/notifications/{id}/read', [NotificationController::class, 'markRead']);
    Route::get('/login-activities', [LoginActivityController::class, 'index'])->middleware('role:KABAG_UMUM,KASUBAG_UMUM');
    Route::get('/rooms', [RoomController::class, 'index']);
    Route::get('/rooms/{id}/image', [RoomController::class, 'image']);
    Route::post('/rooms', [RoomController::class, 'store'])->middleware($resourceManagers);
    Route::post('/rooms/{id}', [RoomController::class, 'update'])->middleware($resourceManagers);
    Route::put('/rooms/{id}', [RoomController::class, 'update'])->middleware($resourceManagers);
    Route::delete('/rooms/{id}', [RoomController::class, 'destroy'])->middleware($resourceManagers);

    Route::get('/items', [ItemController::class, 'index']);
    Route::get('/items/{id}/image', [ItemController::class, 'image']);
    Route::post('/items', [ItemController::class, 'store'])->middleware($resourceManagers);
    Route::post('/items/{id}', [ItemController::class, 'update'])->middleware($resourceManagers);
    Route::put('/items/{id}', [ItemController::class, 'update'])->middleware($resourceManagers);

    Route::get('/room-booking-settings', [RoomBookingSettingController::class, 'show']);
    Route::put('/room-booking-settings', [RoomBookingSettingController::class, 'update'])->middleware('role:KABAG_UMUM,KASUBAG_UMUM');

    /** Notices shown after login; the feed is role-scoped, the CRUD is not. */
    Route::get('/attention-messages', [AttentionMessageController::class, 'feed']);
    Route::middleware('role:KABAG_UMUM,KASUBAG_UMUM')->group(function (): void {
        Route::get('/attention-messages/manage', [AttentionMessageController::class, 'index']);
        Route::post('/attention-messages/manage', [AttentionMessageController::class, 'store']);
        Route::put('/attention-messages/manage/{id}', [AttentionMessageController::class, 'update']);
        Route::delete('/attention-messages/manage/{id}', [AttentionMessageController::class, 'destroy']);
        Route::put('/maintenance', [MaintenanceSettingController::class, 'update']);
    });

    Route::middleware('role:KABAG_UMUM,KASUBAG_UMUM')->controller(ManagedUserController::class)->group(function (): void {
        Route::get('/room-managers', 'roomManagers');
        Route::post('/room-managers', 'storeRoomManager');
        Route::put('/room-managers/{id}', 'updateRoomManager');
        Route::delete('/room-managers/{id}', 'destroyRoomManager');
        Route::get('/department-heads', 'departmentHeads');
        Route::post('/department-heads', 'storeDepartmentHead');
        Route::put('/department-heads/{id}', 'updateDepartmentHead');
        Route::delete('/department-heads/{id}', 'destroyDepartmentHead');
        Route::get('/users', 'users');
        Route::post('/users', 'storeUser');
        Route::put('/users/{id}', 'updateUser');
        Route::delete('/users/{id}', 'destroyUser');
    });

    Route::get('/bookings/availability', [BookingController::class, 'availability'])->middleware('role:PEMOHON');
    Route::get('/bookings/availability-summary', [BookingController::class, 'availabilitySummary'])->middleware('role:PEMOHON,KABAG_UMUM,KASUBAG_UMUM');
    Route::post('/bookings', [BookingController::class, 'store'])->middleware(['role:PEMOHON', 'throttle:booking-create']);
    Route::post('/bookings/{id}', [BookingController::class, 'update'])->middleware('role:PEMOHON');
    Route::put('/bookings/{id}', [BookingController::class, 'update'])->middleware('role:PEMOHON');
    Route::delete('/bookings/{id}', [BookingController::class, 'destroy'])->middleware('role:PEMOHON');
    Route::patch('/bookings/{id}/confirm-finished', [BookingController::class, 'confirmFinished'])->middleware('role:PEMOHON');
    Route::get('/bookings/my', [BookingController::class, 'mine']);
    Route::get('/bookings/{id}/document', [BookingController::class, 'document']);
    Route::get('/bookings/{id}/surat-tugas', [BookingController::class, 'suratTugas']);
    Route::get('/bookings', [BookingController::class, 'index'])->middleware('role:PJ_RUANGAN,KABAG_UMUM,KASUBAG_UMUM');
    Route::patch('/bookings/{id}/pj-review', [BookingController::class, 'pjReview'])->middleware('role:PJ_RUANGAN');
    Route::patch('/bookings/{id}/kabag-approve', [BookingController::class, 'kabagApprove'])->middleware('role:KASUBAG_UMUM');
    Route::patch('/bookings/{id}/alternative', [BookingController::class, 'alternative'])->middleware('role:KASUBAG_UMUM,PJ_RUANGAN');
    Route::patch('/bookings/{id}/pj-confirm', [BookingController::class, 'pjConfirm'])->middleware('role:PJ_RUANGAN');
    Route::patch('/bookings/{id}/pj-inspect', [BookingController::class, 'pjInspect'])->middleware('role:PJ_RUANGAN');

    Route::get('/room-booking-cancellations/options', [RoomBookingCancellationController::class, 'options'])->middleware('role:PJ_RUANGAN');
    Route::post('/room-booking-cancellations', [RoomBookingCancellationController::class, 'store'])->middleware('role:PJ_RUANGAN');
    Route::get('/room-booking-cancellations', [RoomBookingCancellationController::class, 'index'])->middleware('role:PJ_RUANGAN,KASUBAG_UMUM');
});
