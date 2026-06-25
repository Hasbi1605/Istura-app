<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class UpdateBookingContactRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isOperator() ?? false;
    }

    public function rules(): array
    {
        // Mirror StoreAdminBookingRequest identity rules so the edit form keeps
        // the exact same validation contract for the four editable fields.
        return [
            'contactName' => ['required', 'string', 'max:120', 'regex:/^[\p{L}][\p{L}\s.\'-]*$/u'],
            'nik' => ['required', 'string', 'regex:/^\d{16}$/'],
            'whatsapp' => ['required', 'string', 'max:32', 'regex:/^(08|628)\d{8,13}$/'],
            'institution' => ['required', 'string', 'max:200', 'regex:/^(?=.*[\p{L}\d])[\p{L}\d\s.,\'()\/&-]+$/u'],
        ];
    }

    public function messages(): array
    {
        return [
            'contactName.regex' => 'Nama hanya boleh berisi huruf, spasi, titik, tanda kutip, atau strip.',
            'nik.regex' => 'NIK harus 16 digit angka.',
            'whatsapp.regex' => 'Nomor WhatsApp harus diawali 08 atau 628 dan berisi 10-15 digit.',
            'institution.regex' => 'Instansi mengandung karakter yang tidak diperbolehkan.',
        ];
    }
}
