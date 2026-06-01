<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateWaTemplatesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isAdmin() ?? false;
    }

    public function rules(): array
    {
        return [
            'items' => ['required', 'array'],
            'items.*.id' => ['required', Rule::in(['Pending', 'Accepted', 'Rejected', 'Reschedule', 'Completed'])],
            'items.*.label' => ['required', 'string', 'max:120'],
            'items.*.description' => ['required', 'string', 'max:255'],
            'items.*.template' => ['required', 'string'],
        ];
    }
}
