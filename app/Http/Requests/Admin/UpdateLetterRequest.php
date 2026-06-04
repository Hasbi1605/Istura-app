<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\Validator;

class UpdateLetterRequest extends FormRequest
{
    public const LETTER_IMAGE_MAX_WIDTH = 2800;

    public const LETTER_IMAGE_MAX_HEIGHT = 3600;

    public const LETTER_IMAGE_MAX_PIXELS = self::LETTER_IMAGE_MAX_WIDTH * self::LETTER_IMAGE_MAX_HEIGHT;

    public function authorize(): bool
    {
        return $this->user()?->isAdmin() ?? false;
    }

    public function rules(): array
    {
        return [
            'checklist' => ['required', 'array', 'min:1'],
            'checklist.*' => ['required', 'string', 'max:255'],
            'image' => [
                'sometimes',
                'file',
                'image',
                'mimes:jpg,jpeg,png,webp',
                'max:5120',
                'dimensions:max_width='.self::LETTER_IMAGE_MAX_WIDTH.',max_height='.self::LETTER_IMAGE_MAX_HEIGHT,
            ],
            'rulesDescription' => ['required', 'string', 'max:1000'],
            'rulesImage' => [
                'sometimes',
                'file',
                'image',
                'mimes:jpg,jpeg,png,webp',
                'max:5120',
                'dimensions:max_width='.self::LETTER_IMAGE_MAX_WIDTH.',max_height='.self::LETTER_IMAGE_MAX_HEIGHT,
            ],
        ];
    }

    /**
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                foreach (['image', 'rulesImage'] as $fieldName) {
                    $image = $this->file($fieldName);
                    if (! $image instanceof UploadedFile || ! $image->isValid()) {
                        continue;
                    }

                    $realPath = $image->getRealPath();
                    if (! is_string($realPath) || $realPath === '') {
                        $validator->errors()->add($fieldName, 'Gambar tidak dapat dibaca.');
                        continue;
                    }

                    $dimensions = @getimagesize($realPath);
                    if (! is_array($dimensions)) {
                        $validator->errors()->add($fieldName, 'Gambar tidak dapat dibaca.');
                        continue;
                    }

                    $width = (int) ($dimensions[0] ?? 0);
                    $height = (int) ($dimensions[1] ?? 0);
                    if ($width < 1 || $height < 1 || $height > intdiv(self::LETTER_IMAGE_MAX_PIXELS, max(1, $width))) {
                        $validator->errors()->add($fieldName, 'Total piksel gambar terlalu besar.');
                    }
                }
            },
        ];
    }
}
