<?php

namespace App\Http\Requests\Public;

use Carbon\Carbon;
use Illuminate\Foundation\Http\FormRequest;

class StoreBookingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $today = Carbon::today('Asia/Jakarta');
        $earliestDate = $today->copy()->addDay()->toDateString();

        return [
            'contactName' => ['required', 'string', 'max:120'],
            'nik' => ['required', 'string', 'regex:/^\d{16}$/'],
            'whatsapp' => ['required', 'string', 'max:32'],
            'institution' => ['required', 'string', 'max:200'],
            'groupSize' => ['required', 'integer', 'min:1', 'max:560'],
            'date' => [
                'required',
                'date_format:Y-m-d',
                'after_or_equal:'.$earliestDate,
                'before_or_equal:'.$today->copy()->addMonths(2)->toDateString(),
            ],
            'time' => ['required', 'string', 'regex:/^\d{2}\.\d{2}$/'],
            'document' => ['required', 'file', 'mimes:pdf,png,jpg,jpeg', 'max:5120'],
            'agreement' => ['required', 'accepted'],
        ];
    }

    public function messages(): array
    {
        return [
            'nik.regex' => 'NIK harus 16 digit angka.',
            'agreement.accepted' => 'Persetujuan wajib dicentang.',
            'date.after_or_equal' => 'Tanggal kunjungan paling cepat besok.',
            'groupSize.max' => 'Jumlah rombongan maksimal 560 orang per hari kunjungan.',
            'document.mimes' => 'Surat permohonan harus berformat PDF, PNG, atau JPG.',
            'document.max' => 'Ukuran surat maksimal 5 MB.',
        ];
    }
}
