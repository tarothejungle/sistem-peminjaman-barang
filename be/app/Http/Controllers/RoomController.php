<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Http\Requests\RoomRequest;
use App\Models\Room;
use App\Services\ResourceImageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;

final class RoomController extends Controller
{
    public function __construct(private readonly ResourceImageService $images) {}

    public function index(): JsonResponse
    {
        return response()->json(['data' => Room::where('is_active', true)->orderBy('name')->get()]);
    }

    public function store(RoomRequest $request): JsonResponse
    {
        $data = $request->validated();
        $data['facilities'] = array_values(array_unique(array_map('trim', $data['facilities'])));

        $room = $this->images->persistWithImage($data, $request->file('image'), 'rooms', null, fn (array $attributes): Room => Room::create($attributes));

        return response()->json(['data' => $room], 201);
    }

    public function update(RoomRequest $request, string $id): JsonResponse
    {
        $room = $this->find($id);
        $data = $request->validated();
        if (isset($data['facilities'])) {
            $data['facilities'] = array_values(array_unique(array_map('trim', $data['facilities'])));
        }

        $this->images->persistWithImage($data, $request->file('image'), 'rooms', $room->image_path, function (array $attributes) use ($room): Room {
            $room->update($attributes);

            return $room;
        });

        return response()->json(['data' => $room->refresh()]);
    }

    public function image(string $id): Response
    {
        $room = $this->find($id);
        if (! $room->image_path || ! Storage::disk('local')->exists($room->image_path)) {
            throw new ApiException('Foto ruang rapat tidak ditemukan', 404);
        }

        return response(Storage::disk('local')->get($room->image_path), 200, [
            'Content-Type' => $room->image_mime,
            'Cache-Control' => 'private, max-age=3600',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function destroy(string $id): JsonResponse
    {
        $room = $this->find($id);
        $room->update(['is_active' => false]);

        return response()->json(['data' => $room->refresh()]);
    }

    private function find(string $id): Room
    {
        $this->assertUuid($id, 'ID ruang rapat tidak valid');

        return Room::find($id) ?? throw new ApiException('Ruang rapat tidak ditemukan', 404);
    }
}
