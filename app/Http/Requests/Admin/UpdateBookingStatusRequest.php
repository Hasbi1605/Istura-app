<?php

namespace App\Http\Requests\Admin;

use App\Rules\SafePublicUrl;
use Illuminate\Foundation\Http\FormRequest;

class UpdateBookingStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isOperator() ?? false;
    }

    public function rules(): array
    {
        return [
            'note' => ['nullable', 'string', 'max:2000'],
            // Hanya relevan untuk aksi "complete"; aman karena nullable pada aksi lain.
            'documentationLink' => ['nullable', 'string', 'max:2000', SafePublicUrl::documentation()],
        ];
    }
}
