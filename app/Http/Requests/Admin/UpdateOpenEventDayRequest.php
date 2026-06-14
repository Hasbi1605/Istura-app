<?php

namespace App\Http\Requests\Admin;

use App\Rules\SafePublicUrl;
use Illuminate\Foundation\Http\FormRequest;

class UpdateOpenEventDayRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->isAdmin();
    }

    public function rules(): array
    {
        return [
            'quotaOverride' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:100000'],
            'whatsappGroupUrl' => ['sometimes', 'nullable', 'string', 'max:300', new SafePublicUrl(['https'], ['chat.whatsapp.com'], allowRelative: false)],
            'opensAt' => ['sometimes', 'nullable', 'date'],
            'isOpen' => ['sometimes', 'boolean'],
            'acknowledgeConflicts' => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'whatsappGroupUrl.*' => 'Link grup harus tautan https chat.whatsapp.com yang valid.',
        ];
    }
}
