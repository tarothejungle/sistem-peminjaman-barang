<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ApiException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

final class ResourceImageService
{
    private const EXTENSIONS = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];

    private const MAX_IMAGE_DIMENSION = 8000;

    private const MAX_IMAGE_PIXELS = 25_000_000;

    public function store(UploadedFile $image, string $folder): array
    {
        $content = $image->getContent();
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->buffer($content);
        $dimensions = $mime !== false ? @getimagesizefromstring($content) : false;
        $detectedMime = is_array($dimensions) ? image_type_to_mime_type($dimensions[2]) : null;
        if (! $mime || ! is_string($detectedMime) || $mime !== $detectedMime || ! isset(self::EXTENSIONS[$mime])) {
            throw new ApiException('Foto harus berupa JPEG, PNG, atau WebP yang valid', 400);
        }
        [$width, $height] = $dimensions;
        if ($width < 1 || $height < 1
            || $width > self::MAX_IMAGE_DIMENSION
            || $height > self::MAX_IMAGE_DIMENSION
            || $width * $height > self::MAX_IMAGE_PIXELS) {
            throw new ApiException('Dimensi foto terlalu besar', 422);
        }

        $path = "resource-images/{$folder}/".Str::uuid().'.'.self::EXTENSIONS[$mime];
        if (! Storage::disk('local')->put($path, $content)) {
            throw new ApiException('Foto gagal disimpan', 500);
        }

        return ['image_path' => $path, 'image_mime' => $mime];
    }

    public function delete(?string $path): void
    {
        if ($path) {
            Storage::disk('local')->delete($path);
        }
    }

    /**
     * Runs the persistence callback with a freshly stored image merged into the
     * given attributes, keeping the store/update image lifecycle identical for
     * every resource while each controller keeps its own attribute mapping.
     *
     * If persistence throws, the new file is removed so a failed write never
     * leaves an orphan; on success the previous image (if any) is deleted.
     *
     * @param  array<string, mixed>  $attributes
     * @param  callable(array<string, mixed>): mixed  $persist
     */
    public function persistWithImage(array $attributes, ?UploadedFile $image, string $folder, ?string $previousPath, callable $persist): mixed
    {
        if ($image) {
            $attributes = array_merge($attributes, $this->store($image, $folder));
        }
        unset($attributes['image']);

        try {
            $result = $persist($attributes);
        } catch (Throwable $exception) {
            if ($image) {
                $this->delete($attributes['image_path'] ?? null);
            }
            throw $exception;
        }

        if ($image && $previousPath) {
            $this->delete($previousPath);
        }

        return $result;
    }
}
