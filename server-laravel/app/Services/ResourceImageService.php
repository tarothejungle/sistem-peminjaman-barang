<?php

namespace App\Services;

use App\Exceptions\ApiException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

final class ResourceImageService
{
    private const EXTENSIONS = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];

    public function store(UploadedFile $image, string $folder): array
    {
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->buffer($image->getContent());
        if (! $mime || ! isset(self::EXTENSIONS[$mime])) {
            throw new ApiException('Foto harus berupa JPEG, PNG, atau WebP yang valid', 400);
        }

        $path = "resource-images/{$folder}/".Str::uuid().'.'.self::EXTENSIONS[$mime];
        if (! Storage::disk('local')->put($path, $image->getContent())) {
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
}
