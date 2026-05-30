<?php

namespace App\Http\Requests\Admin;

use App\Rules\SafePublicUrl;
use Illuminate\Foundation\Http\FormRequest;

class UpdateFaqsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isAdmin() ?? false;
    }

    public function rules(): array
    {
        return [
            'items' => ['required', 'array'],
            'items.*.id' => ['required', 'string', 'max:64'],
            'items.*.question' => ['required', 'string', 'max:255'],
            'items.*.answer' => ['required', 'string'],
            'items.*.category' => ['nullable', 'string', 'max:64'],
            'items.*.link' => ['nullable', 'array'],
            'items.*.link.label' => ['nullable', 'string', 'max:120'],
            'items.*.link.href' => ['nullable', 'string', 'max:500', SafePublicUrl::link()],
        ];
    }
}
