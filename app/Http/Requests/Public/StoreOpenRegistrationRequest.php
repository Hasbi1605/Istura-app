<?php

namespace App\Http\Requests\Public;

use Illuminate\Foundation\Http\FormRequest;

class StoreOpenRegistrationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'contactName' => ['required', 'string', 'max:120', 'regex:/^[\p{L}][\p{L}\s.\'-]*$/u'],
            'nik' => ['required', 'string', 'regex:/^\d{16}$/'],
            'whatsapp' => ['required', 'string', 'max:32', 'regex:/^(08|628)\d{8,13}$/'],
            'city' => ['required', 'string', 'max:100'],
            'assignedDayId' => ['required', 'integer', 'min:1'],
            'members' => ['sometimes', 'array', 'max:20'],
            'members.*' => ['required', 'string', 'max:120', 'regex:/^[\p{L}][\p{L}\s.\'-]*$/u'],
            'agreement' => ['required', 'accepted'],
        ];
    }

    public function messages(): array
    {
        return [
            'nik.regex' => 'NIK harus 16 digit angka.',
            'contactName.regex' => 'Nama hanya boleh berisi huruf, spasi, titik, apostrof, atau tanda hubung.',
            'members.*.regex' => 'Nama anggota hanya boleh berisi huruf, spasi, titik, apostrof, atau tanda hubung.',
            'whatsapp.regex' => 'Nomor WhatsApp harus aktif, contoh 08xxxxxxxxxx.',
            'city.required' => 'Asal kota wajib diisi.',
            'city.max' => 'Asal kota maksimal 100 karakter.',
            'agreement.accepted' => 'Persetujuan wajib dicentang.',
            'assignedDayId.required' => 'Pilih hari kunjungan terlebih dahulu.',
        ];
    }
}
