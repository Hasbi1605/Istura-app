<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class DeleteBookingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->isOperator();
    }

    public function rules(): array
    {
        return [
            'confirmCode' => ['required', 'string', 'max:64'],
        ];
    }
}
