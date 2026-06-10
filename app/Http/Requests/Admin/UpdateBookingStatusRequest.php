<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class UpdateBookingStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isAdmin() ?? false;
    }

    public function rules(): array
    {
        return [
            'note' => ['nullable', 'string', 'max:2000'],
            // Hanya relevan untuk aksi "complete"; aman karena nullable pada aksi lain.
            'documentationLink' => ['nullable', 'string', 'url', 'max:2000'],
        ];
    }
}
