<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class UpdateLetterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isAdmin() ?? false;
    }

    public function rules(): array
    {
        return [
            'checklist' => ['required', 'array', 'min:1'],
            'checklist.*' => ['required', 'string', 'max:255'],
            'image' => ['sometimes', 'file', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        ];
    }
}
