<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class RescheduleBookingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isAdmin() ?? false;
    }

    public function rules(): array
    {
        return [
            'proposedDate' => ['required', 'date_format:Y-m-d'],
            'proposedTime' => ['required', 'string', 'regex:/^\d{2}\.\d{2}$/'],
            'note' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
