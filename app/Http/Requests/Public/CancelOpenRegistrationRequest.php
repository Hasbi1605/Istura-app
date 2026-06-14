<?php

namespace App\Http\Requests\Public;

use Illuminate\Foundation\Http\FormRequest;

class CancelOpenRegistrationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'nik' => ['required', 'string', 'regex:/^\d{16}$/'],
            'whatsapp' => ['required', 'string', 'regex:/^(08|628)\d{8,13}$/'],
        ];
    }

    public function messages(): array
    {
        return [
            'nik.regex' => 'NIK harus 16 digit angka.',
            'whatsapp.regex' => 'Nomor WhatsApp tidak valid.',
        ];
    }
}
