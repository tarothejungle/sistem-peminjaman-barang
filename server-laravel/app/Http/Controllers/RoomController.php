<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Http\Requests\RoomRequest;
use App\Models\Room;
use App\Services\ResourceImageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
use Throwable;

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
        if ($request->hasFile('image')) {
            $data = array_merge($data, $this->images->store($request->file('image'), 'rooms'));
        }
        unset($data['image']);

        try {
            return response()->json(['data' => Room::create($data)], 201);
        } catch (Throwable $exception) {
            $this->images->delete($data['image_path'] ?? null);
            throw $exception;
        }
    }

    public function update(RoomRequest $request, string $id): JsonResponse
    {
        $room = $this->find($id);
        $oldImage = $room->image_path;
        $data = $request->validated();
        if (isset($data['facilities'])) {
            $data['facilities'] = array_values(array_unique(array_map('trim', $data['facilities'])));
        }
        if ($request->hasFile('image')) {
            $data = array_merge($data, $this->images->store($request->file('image'), 'rooms'));
        }
        unset($data['image']);
        try {
            $room->update($data);
        } catch (Throwable $exception) {
            $this->images->delete($data['image_path'] ?? null);
            throw $exception;
        }
        if ($request->hasFile('image')) {
            $this->images->delete($oldImage);
        }

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
        if (! preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $id)) {
            throw new ApiException('ID ruang rapat tidak valid', 400);
        }

        return Room::find($id) ?? throw new ApiException('Ruang rapat tidak ditemukan', 404);
    }
}
