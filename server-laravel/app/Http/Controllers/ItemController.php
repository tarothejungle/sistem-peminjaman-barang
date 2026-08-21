<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Http\Requests\ItemRequest;
use App\Models\Item;
use App\Services\ResourceImageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
use Throwable;

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
        if ($request->hasFile('image')) {
            $data = array_merge($data, $this->images->store($request->file('image'), 'items'));
        }
        unset($data['image']);

        try {
            return response()->json(['data' => Item::create($data)], 201);
        } catch (Throwable $exception) {
            $this->images->delete($data['image_path'] ?? null);
            throw $exception;
        }
    }

    public function update(ItemRequest $request, string $id): JsonResponse
    {
        if (! preg_match('/^[0-9a-f-]{36}$/i', $id)) {
            throw new ApiException('ID barang tidak valid', 400);
        }
        $item = Item::find($id) ?? throw new ApiException('Barang tidak ditemukan', 404);
        $oldImage = $item->image_path;
        $data = $request->validated();
        if (array_key_exists('totalStock', $data)) {
            $data['total_stock'] = $data['totalStock'];
            unset($data['totalStock']);
        }
        if ($request->hasFile('image')) {
            $data = array_merge($data, $this->images->store($request->file('image'), 'items'));
        }
        unset($data['image']);
        try {
            $item->update($data);
        } catch (Throwable $exception) {
            $this->images->delete($data['image_path'] ?? null);
            throw $exception;
        }
        if ($request->hasFile('image')) {
            $this->images->delete($oldImage);
        }

        return response()->json(['data' => $item->refresh()]);
    }

    public function image(string $id): Response
    {
        if (! preg_match('/^[0-9a-f-]{36}$/i', $id)) {
            throw new ApiException('ID barang tidak valid', 400);
        }
        $item = Item::find($id) ?? throw new ApiException('Barang tidak ditemukan', 404);
        if (! $item->image_path || ! Storage::disk('local')->exists($item->image_path)) {
            throw new ApiException('Foto barang tidak ditemukan', 404);
        }

        return response(Storage::disk('local')->get($item->image_path), 200, [
            'Content-Type' => $item->image_mime,
            'Cache-Control' => 'private, max-age=3600',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
