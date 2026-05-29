<?php

namespace App\Http\Requests\Admin;

use App\Models\FooterContact;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateFooterContactsRequest extends FormRequest
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
            'items.*.label' => ['required', 'string', 'max:120'],
            'items.*.value' => ['required', 'string', 'max:255'],
            'items.*.href' => ['nullable', 'string', 'max:500'],
            'items.*.iconKey' => ['required', Rule::in(FooterContact::ICONS)],
        ];
    }
}
