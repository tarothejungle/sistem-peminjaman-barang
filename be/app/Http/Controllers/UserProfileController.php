<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Http\Requests\UpdateProfileRequest;
use App\Http\Requests\UploadProfilePhotoRequest;
use App\Models\User;
use App\Services\ResourceImageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
use Throwable;

final class UserProfileController extends Controller
{
    public function __construct(private readonly ResourceImageService $images) {}

    public function update(UpdateProfileRequest $request): JsonResponse
    {
        $user = $this->user($request);
        $data = $request->validated();
        $attributes = ['phone_number' => trim($data['phoneNumber'])];

        if ($user->role->isAdministrator() && array_key_exists('fullName', $data)) {
            $attributes['full_name'] = trim($data['fullName']);
        }
        if ($user->role->isAdministrator() && array_key_exists('email', $data)) {
            $attributes['email'] = strtolower($data['email']);
        }

        $user->update($attributes);

        return response()->json(['data' => $user->refresh()]);
    }

    public function uploadPhoto(UploadProfilePhotoRequest $request): JsonResponse
    {
        $user = $this->user($request);
        $oldPath = $user->profile_image_path;
        $stored = $this->images->store($request->file('image'), 'profiles');

        try {
            $user->update([
                'profile_image_path' => $stored['image_path'],
                'profile_image_mime' => $stored['image_mime'],
            ]);
        } catch (Throwable $exception) {
            $this->images->delete($stored['image_path']);
            throw $exception;
        }

        $this->images->delete($oldPath);

        return response()->json(['data' => $user->refresh()]);
    }

    public function deletePhoto(Request $request): JsonResponse
    {
        if ($request->all() !== []) {
            throw new ApiException('Data tidak valid', 400);
        }
        $user = $this->user($request);
        $oldPath = $user->profile_image_path;
        $user->update(['profile_image_path' => null, 'profile_image_mime' => null]);
        $this->images->delete($oldPath);

        return response()->json(['data' => $user->refresh()]);
    }

    public function photo(Request $request): Response
    {
        $user = $this->user($request);
        if (! $user->profile_image_path || ! Storage::disk('local')->exists($user->profile_image_path)) {
            throw new ApiException('Foto profil tidak ditemukan', 404);
        }

        return response(Storage::disk('local')->get($user->profile_image_path), 200, [
            'Content-Type' => $user->profile_image_mime,
            'Cache-Control' => 'private, no-cache',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    private function user(Request $request): User
    {
        return User::find($request->attributes->get('auth_user_id'))
            ?? throw new ApiException('Pengguna tidak ditemukan', 404);
    }
}
