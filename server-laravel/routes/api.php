<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\BookingController;
use App\Http\Controllers\ItemController;
use App\Http\Controllers\ManagedUserController;
use App\Http\Controllers\RoomBookingSettingController;
use App\Http\Controllers\RoomController;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

Route::get('/health', function () {
    DB::select('SELECT 1');

    return response()->json(['data' => ['status' => 'ok']]);
});

Route::prefix('auth')->controller(AuthController::class)->group(function (): void {
    Route::post('/login', 'login')->middleware('throttle:auth-login');
    Route::post('/refresh', 'refresh')->middleware('throttle:auth-refresh');
    Route::post('/logout', 'logout');
    Route::post('/activity', 'activity')->middleware('jwt');
    Route::get('/me', 'me')->middleware('jwt');
    Route::patch('/password', 'changePassword')->middleware(['jwt', 'throttle:auth-password']);
});

Route::middleware('jwt')->group(function (): void {
    Route::get('/rooms', [RoomController::class, 'index']);
    Route::get('/rooms/{id}/image', [RoomController::class, 'image']);
    Route::post('/rooms', [RoomController::class, 'store'])->middleware('role:KABAG_UMUM');
    Route::post('/rooms/{id}', [RoomController::class, 'update'])->middleware('role:KABAG_UMUM');
    Route::put('/rooms/{id}', [RoomController::class, 'update'])->middleware('role:KABAG_UMUM');
    Route::delete('/rooms/{id}', [RoomController::class, 'destroy'])->middleware('role:KABAG_UMUM');

    Route::get('/items', [ItemController::class, 'index']);
    Route::get('/items/{id}/image', [ItemController::class, 'image']);
    Route::post('/items', [ItemController::class, 'store'])->middleware('role:KABAG_UMUM');
    Route::post('/items/{id}', [ItemController::class, 'update'])->middleware('role:KABAG_UMUM');
    Route::put('/items/{id}', [ItemController::class, 'update'])->middleware('role:KABAG_UMUM');

    Route::get('/room-booking-settings', [RoomBookingSettingController::class, 'show']);
    Route::put('/room-booking-settings', [RoomBookingSettingController::class, 'update'])->middleware('role:KABAG_UMUM');

    Route::middleware('role:KABAG_UMUM')->controller(ManagedUserController::class)->group(function (): void {
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
    Route::get('/bookings/availability-summary', [BookingController::class, 'availabilitySummary'])->middleware('role:PEMOHON,KABAG_UMUM');
    Route::post('/bookings', [BookingController::class, 'store'])->middleware('role:PEMOHON');
    Route::post('/bookings/{id}', [BookingController::class, 'update'])->middleware('role:PEMOHON');
    Route::put('/bookings/{id}', [BookingController::class, 'update'])->middleware('role:PEMOHON');
    Route::delete('/bookings/{id}', [BookingController::class, 'destroy'])->middleware('role:PEMOHON');
    Route::patch('/bookings/{id}/confirm-finished', [BookingController::class, 'confirmFinished'])->middleware('role:PEMOHON');
    Route::get('/bookings/my', [BookingController::class, 'mine']);
    Route::get('/bookings/{id}/document', [BookingController::class, 'document']);
    Route::get('/bookings/pending-count', [BookingController::class, 'pendingCount'])->middleware('role:PJ_RUANGAN,KABAG_UMUM');
    Route::get('/bookings', [BookingController::class, 'index'])->middleware('role:PJ_RUANGAN,KABAG_UMUM');
    Route::patch('/bookings/{id}/pj-review', [BookingController::class, 'pjReview'])->middleware('role:PJ_RUANGAN');
    Route::patch('/bookings/{id}/kabag-approve', [BookingController::class, 'kabagApprove'])->middleware('role:KABAG_UMUM');
    Route::patch('/bookings/{id}/pj-confirm', [BookingController::class, 'pjConfirm'])->middleware('role:PJ_RUANGAN');
    Route::patch('/bookings/{id}/pj-inspect', [BookingController::class, 'pjInspect'])->middleware('role:PJ_RUANGAN');
});
