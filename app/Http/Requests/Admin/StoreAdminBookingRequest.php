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
            'segments' => ['sometimes', 'array', 'min:1', 'max:7'],
            'segments.*.date' => ['required_with:segments', 'date_format:Y-m-d'],
            'segments.*.time' => ['required_with:segments', 'string', 'regex:/^\d{2}\.\d{2}$/', new VisitTime],
            'segments.*.groupSize' => ['required_with:segments', 'integer', 'min:1', 'max:560'],
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

                $segments = $this->input('segments', []);
                if ($segments === []) {
                    return;
                }

                $total = 0;
                $bookingDate = $this->input('date');
                $today = Carbon::today('Asia/Jakarta');
                $maxDate = $today->copy()->addMonths(2);

                foreach ($segments as $index => $segment) {
                    $segmentDateValue = $segment['date'] ?? null;
                    $segmentTimeValue = $segment['time'] ?? null;
                    $segmentGroupSize = $segment['groupSize'] ?? null;

                    if (! is_string($segmentDateValue) || ! preg_match('/^\d{4}-\d{2}-\d{2}$/', $segmentDateValue)
                        || ! is_string($segmentTimeValue) || ! preg_match('/^\d{2}\.\d{2}$/', $segmentTimeValue)
                        || ! is_numeric($segmentGroupSize)) {
                        continue;
                    }

                    try {
                        $segmentDate = Carbon::createFromFormat('Y-m-d', $segmentDateValue, 'Asia/Jakarta')->startOfDay();
                        $startsAt = Carbon::createFromFormat('Y-m-d H.i', $segmentDateValue.' '.$segmentTimeValue, 'Asia/Jakarta');
                    } catch (\Throwable) {
                        continue;
                    }

                    if ($segmentDateValue !== $bookingDate) {
                        $validator->errors()->add("segments.{$index}.date", 'Tanggal kloter harus sama dengan tanggal booking manual.');
                    }
                    if ($segmentDate->lt($today)) {
                        $validator->errors()->add("segments.{$index}.date", 'Tanggal kloter tidak boleh sudah lewat.');
                    }
                    if ($segmentDate->gt($maxDate)) {
                        $validator->errors()->add("segments.{$index}.date", 'Tanggal kloter maksimal 2 bulan dari hari ini.');
                    }

                    if ($startsAt->lte(now('Asia/Jakarta'))) {
                        $validator->errors()->add("segments.{$index}.time", 'Jam kloter harus berada setelah waktu saat ini.');
                    }

                    $total += (int) $segmentGroupSize;
                }

                if ($total !== (int) $this->input('groupSize')) {
                    $validator->errors()->add('segments', "Total peserta kloter ({$total}) harus sama dengan jumlah peserta booking manual.");
                }
            },
        ];
    }
}
