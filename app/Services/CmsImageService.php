<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CmsImageService
{
    public const MAX_INPUT_WIDTH = 2800;

    public const MAX_INPUT_HEIGHT = 3600;

    public const MAX_INPUT_PIXELS = self::MAX_INPUT_WIDTH * self::MAX_INPUT_HEIGHT;

    public const WEBP_QUALITY = 82;

    public function storePublicWebp(
        UploadedFile $image,
        string $directory,
        string $attribute,
        int $maxOutputWidth,
        int $maxOutputHeight,
        bool $preserveTransparency = false,
    ): string {
        $realPath = $this->validatedImagePath($image, $attribute);

        if (! function_exists('imagecreatefromstring') || ! function_exists('imagewebp')) {
            throw ValidationException::withMessages([
                $attribute => 'Server belum mendukung konversi gambar ke WebP.',
            ]);
        }

        $sourceBytes = file_get_contents($realPath);
        if ($sourceBytes === false) {
            throw ValidationException::withMessages([
                $attribute => 'Gambar tidak dapat dibaca.',
            ]);
        }

        $source = @imagecreatefromstring($sourceBytes);
        if (! $source instanceof \GdImage) {
            throw ValidationException::withMessages([
                $attribute => 'Gambar tidak dapat diproses.',
            ]);
        }

        $target = null;
        $tmpPath = null;

        try {
            $sourceWidth = imagesx($source);
            $sourceHeight = imagesy($source);
            $scale = min(1, $maxOutputWidth / max(1, $sourceWidth), $maxOutputHeight / max(1, $sourceHeight));
            $targetWidth = max(1, (int) round($sourceWidth * $scale));
            $targetHeight = max(1, (int) round($sourceHeight * $scale));
            $target = imagecreatetruecolor($targetWidth, $targetHeight);
            if (! $target instanceof \GdImage) {
                throw ValidationException::withMessages([
                    $attribute => 'Gambar tidak dapat diproses.',
                ]);
            }

            if ($preserveTransparency) {
                imagealphablending($target, false);
                imagesavealpha($target, true);
                $background = imagecolorallocatealpha($target, 0, 0, 0, 127);
            } else {
                $background = imagecolorallocate($target, 255, 255, 255);
            }

            if ($background === false || ! imagefill($target, 0, 0, $background)) {
                throw ValidationException::withMessages([
                    $attribute => 'Gambar tidak dapat diproses.',
                ]);
            }

            if (! imagecopyresampled($target, $source, 0, 0, 0, 0, $targetWidth, $targetHeight, $sourceWidth, $sourceHeight)) {
                throw ValidationException::withMessages([
                    $attribute => 'Gambar tidak dapat diproses.',
                ]);
            }

            $tmpPath = tempnam(sys_get_temp_dir(), 'istura-cms-');
            if (! is_string($tmpPath) || ! imagewebp($target, $tmpPath, self::WEBP_QUALITY)) {
                throw ValidationException::withMessages([
                    $attribute => 'Gambar gagal dikonversi ke WebP.',
                ]);
            }

            $optimizedBytes = file_get_contents($tmpPath);
            if ($optimizedBytes === false || $optimizedBytes === '') {
                throw ValidationException::withMessages([
                    $attribute => 'Gambar gagal dikonversi ke WebP.',
                ]);
            }

            $path = trim($directory, '/').'/'.Str::uuid().'.webp';
            if (! Storage::disk('public')->put($path, $optimizedBytes)) {
                throw ValidationException::withMessages([
                    $attribute => 'Gambar gagal disimpan.',
                ]);
            }

            return $path;
        } finally {
            imagedestroy($source);

            if ($target instanceof \GdImage) {
                imagedestroy($target);
            }

            if (is_string($tmpPath)) {
                @unlink($tmpPath);
            }
        }
    }

    private function validatedImagePath(UploadedFile $image, string $attribute): string
    {
        $realPath = $image->getRealPath();
        if (! is_string($realPath) || $realPath === '') {
            throw ValidationException::withMessages([
                $attribute => 'Gambar tidak dapat dibaca.',
            ]);
        }

        $dimensions = @getimagesize($realPath);
        if (! is_array($dimensions)) {
            throw ValidationException::withMessages([
                $attribute => 'Gambar tidak dapat dibaca.',
            ]);
        }

        $width = (int) ($dimensions[0] ?? 0);
        $height = (int) ($dimensions[1] ?? 0);
        if ($width < 1 || $height < 1) {
            throw ValidationException::withMessages([
                $attribute => 'Gambar tidak dapat dibaca.',
            ]);
        }

        if ($width > self::MAX_INPUT_WIDTH || $height > self::MAX_INPUT_HEIGHT) {
            throw ValidationException::withMessages([
                $attribute => 'Dimensi gambar terlalu besar.',
            ]);
        }

        if ($height > intdiv(self::MAX_INPUT_PIXELS, max(1, $width))) {
            throw ValidationException::withMessages([
                $attribute => 'Total piksel gambar terlalu besar.',
            ]);
        }

        return $realPath;
    }
}
