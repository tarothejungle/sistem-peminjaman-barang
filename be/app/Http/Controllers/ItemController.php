<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Http\Requests\ItemRequest;
use App\Models\Item;
use App\Services\ResourceImageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;

final class ItemController extends Controller
{
    public function __construct(private readonly ResourceImageService $images) {}

    public function index(): JsonResponse
    {
        return response()->json(['data' => Item::where('is_active', true)->orderBy('name')->get()]);
    }

    public function store(ItemRequest $request): JsonResponse
    {
        $data = $request->validated();
        $data['total_stock'] = $data['totalStock'];
        unset($data['totalStock']);
        if (array_key_exists('plateNumber', $data)) {
            $data['plate_number'] = $this->normalizePlateNumber($data['plateNumber']);
            unset($data['plateNumber']);
        }

        $item = $this->images->persistWithImage($data, $request->file('image'), 'items', null, fn (array $attributes): Item => Item::create($attributes));

        return response()->json(['data' => $item], 201);
    }

    public function update(ItemRequest $request, string $id): JsonResponse
    {
        $this->assertUuid($id, 'ID kendaraan tidak valid');
        $item = Item::find($id) ?? throw new ApiException('Kendaraan tidak ditemukan', 404);
        $data = $request->validated();
        if (array_key_exists('totalStock', $data)) {
            $data['total_stock'] = $data['totalStock'];
            unset($data['totalStock']);
        }
        if (array_key_exists('plateNumber', $data)) {
            $data['plate_number'] = $this->normalizePlateNumber($data['plateNumber']);
            unset($data['plateNumber']);
        }

        $this->images->persistWithImage($data, $request->file('image'), 'items', $item->image_path, function (array $attributes) use ($item): Item {
            $item->update($attributes);

            return $item;
        });

        return response()->json(['data' => $item->refresh()]);
    }

    public function image(string $id): Response
    {
        $this->assertUuid($id, 'ID kendaraan tidak valid');
        $item = Item::find($id) ?? throw new ApiException('Kendaraan tidak ditemukan', 404);
        if (! $item->image_path || ! Storage::disk('local')->exists($item->image_path)) {
            throw new ApiException('Foto kendaraan tidak ditemukan', 404);
        }

        return response(Storage::disk('local')->get($item->image_path), 200, [
            'Content-Type' => $item->image_mime,
            'Cache-Control' => 'private, max-age=3600',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    /** Normalises "b 1234 xyz" to the plate form staff actually read: "B 1234 XYZ". */
    private function normalizePlateNumber(?string $value): ?string
    {
        $trimmed = trim((string) $value);

        return $trimmed === '' ? null : mb_strtoupper($trimmed);
    }
}
