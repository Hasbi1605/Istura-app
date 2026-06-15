<?php

namespace App\Http\Requests\Public;

use App\Models\ScheduleOverride;
use App\Rules\VisitTime;
use Carbon\Carbon;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreBookingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $today = Carbon::today('Asia/Jakarta');
        $earliestDate = $today->toDateString();

        return [
            'contactName' => ['required', 'string', 'max:120', 'regex:/^[\p{L}][\p{L}\s.\'-]*$/u'],
            'nik' => ['required', 'string', 'regex:/^\d{16}$/'],
            'whatsapp' => ['required', 'string', 'max:32', 'regex:/^(08|628)\d{8,13}$/'],
            'institution' => ['required', 'string', 'max:200', 'regex:/^(?=.*[\p{L}\d])[\p{L}\d\s.,\'()\/&-]+$/u'],
            'groupSize' => ['required', 'integer', 'min:1', 'max:480'],
            'date' => [
                'required',
                'date_format:Y-m-d',
                'after_or_equal:'.$earliestDate,
                'before_or_equal:'.$today->copy()->addMonths(2)->toDateString(),
            ],
            'time' => ['required', 'string', 'regex:/^\d{2}\.\d{2}$/', new VisitTime, Rule::notIn(['12.00'])],
            'document' => ['required', 'file', 'mimes:pdf,png,jpg,jpeg', 'max:5120'],
            'agreement' => ['required', 'accepted'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($validator->errors()->isNotEmpty()) {
                    return;
                }

                $date = Carbon::createFromFormat('Y-m-d', $this->input('date'), 'Asia/Jakarta')->startOfDay();
                if ($date->gte(Carbon::today('Asia/Jakarta')->addDays(2))) {
                    return;
                }

                $startsAt = Carbon::createFromFormat('Y-m-d H.i', $this->input('date').' '.$this->input('time'), 'Asia/Jakarta');
                $override = ScheduleOverride::whereDate('date', $date->toDateString())
                    ->where('time', $this->input('time'))
                    ->first();

                if ($startsAt->lte(now('Asia/Jakarta'))
                    || $override?->short_notice_mode !== 'public'
                    || $override->short_notice_closes_at === null
                    || $override->short_notice_closes_at->copy()->timezone('Asia/Jakarta')->lte(now('Asia/Jakarta'))) {
                    $validator->errors()->add('date', 'Booking H/H+1 hanya tersedia pada slot dadakan yang dibuka admin.');
                }
            },
        ];
    }

    public function messages(): array
    {
        return [
            'nik.regex' => 'NIK harus 16 digit angka.',
            'contactName.regex' => 'Nama contact person hanya boleh berisi huruf, spasi, titik, apostrof, atau tanda hubung.',
            'institution.regex' => 'Asal instansi hanya boleh berisi huruf, angka, spasi, titik, koma, apostrof, tanda hubung, garis miring, ampersand, atau kurung.',
            'whatsapp.regex' => 'Nomor WhatsApp harus aktif, contoh 08xxxxxxxxxx.',
            'agreement.accepted' => 'Persetujuan wajib dicentang.',
            'date.after_or_equal' => 'Tanggal kunjungan tidak boleh sudah lewat.',
            'time.not_in' => 'Jam 12.00 tidak tersedia karena waktu istirahat. Silakan pilih jam layanan lain.',
            'groupSize.max' => 'Jumlah rombongan maksimal 480 orang per hari kunjungan.',
            'document.mimes' => 'Surat permohonan harus berformat PDF, PNG, atau JPG.',
            'document.max' => 'Ukuran surat maksimal 5 MB.',
        ];
    }
}
