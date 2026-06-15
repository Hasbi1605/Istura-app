<?php

namespace App\Http\Requests\Admin;

use App\Models\Booking;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateWaTemplatesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isOperator() ?? false;
    }

    public function rules(): array
    {
        return [
            'items' => ['required', 'array'],
            'items.*.id' => ['required', Rule::in(Booking::STATUSES)],
            'items.*.label' => ['required', 'string', 'max:120'],
            'items.*.description' => ['required', 'string', 'max:255'],
            'items.*.template' => ['required', 'string'],
        ];
    }
}
