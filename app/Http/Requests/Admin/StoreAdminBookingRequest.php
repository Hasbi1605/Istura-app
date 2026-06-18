<?php

namespace App\Http\Requests\Admin;

use App\Rules\VisitTime;
use Carbon\Carbon;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreAdminBookingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isOperator() ?? false;
    }

    public function rules(): array
    {
        $today = Carbon::today('Asia/Jakarta');

        return [
            'contactName' => ['required', 'string', 'max:120', 'regex:/^[\p{L}][\p{L}\s.\'-]*$/u'],
            'nik' => ['required', 'string', 'regex:/^\d{16}$/'],
            'whatsapp' => ['required', 'string', 'max:32', 'regex:/^(08|628)\d{8,13}$/'],
            'institution' => ['required', 'string', 'max:200', 'regex:/^(?=.*[\p{L}\d])[\p{L}\d\s.,\'()\/&-]+$/u'],
            'groupSize' => ['required', 'integer', 'min:1', 'max:560'],
            'date' => ['required', 'date_format:Y-m-d', 'after_or_equal:'.$today->toDateString(), 'before_or_equal:'.$today->copy()->addMonths(2)->toDateString()],
            'time' => ['required', 'string', 'regex:/^\d{2}\.\d{2}$/', new VisitTime],
            'status' => ['required', Rule::in(['Pending', 'Accepted'])],
            'confirmedWithGuest' => ['sometimes', 'boolean'],
            'confirmManualBooking' => ['accepted'],
            'allowOverbook' => ['sometimes', 'boolean'],
            'document' => ['nullable', 'file', 'mimes:pdf,png,jpg,jpeg', 'max:5120'],
            'note' => ['nullable', 'string', 'max:2000'],
        ];
    }

    public function messages(): array
    {
        return [
            'confirmManualBooking.accepted' => 'Konfirmasi bahwa booking manual ini dibuat dari koordinasi admin.',
            'document.mimes' => 'Surat permohonan harus berformat PDF, PNG, atau JPG.',
            'document.max' => 'Ukuran surat maksimal 5 MB.',
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($validator->errors()->isNotEmpty()) {
                    return;
                }

                $startsAt = Carbon::createFromFormat('Y-m-d H.i', $this->input('date').' '.$this->input('time'), 'Asia/Jakarta');
                if ($startsAt->lte(now('Asia/Jakarta'))) {
                    $validator->errors()->add('time', 'Jam kunjungan harus berada setelah waktu saat ini.');
                }

                if ($this->input('status') === 'Accepted' && ! $this->boolean('confirmedWithGuest')) {
                    $validator->errors()->add('confirmedWithGuest', 'Konfirmasi bahwa jadwal sudah disepakati dengan tamu.');
                }
            },
        ];
    }
}
