<?php

namespace App\Http\Requests\Admin;

use App\Rules\VisitTime;
use Carbon\Carbon;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UpdateBookingSegmentsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isOperator() ?? false;
    }

    public function rules(): array
    {
        return [
            'groupSize' => ['sometimes', 'integer', 'min:1', 'max:560'],
            'segments' => ['required', 'array', 'min:1', 'max:7'],
            'segments.*.date' => ['required', 'date_format:Y-m-d'],
            'segments.*.time' => ['required', 'string', 'regex:/^\d{2}\.\d{2}$/', new VisitTime],
            'segments.*.groupSize' => ['required', 'integer', 'min:1', 'max:560'],
            'allowOverbook' => ['sometimes', 'boolean'],
            'correctGroupSize' => ['sometimes', 'boolean'],
            'confirmRisk' => ['sometimes', 'boolean'],
            'note' => ['nullable', 'string', 'max:2000'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($validator->errors()->isNotEmpty()) {
                    return;
                }

                $today = Carbon::today('Asia/Jakarta');
                $maxDate = $today->copy()->addMonths(2);
                foreach ($this->input('segments', []) as $index => $segment) {
                    $date = Carbon::createFromFormat('Y-m-d', $segment['date'], 'Asia/Jakarta')->startOfDay();
                    if ($date->lt($today)) {
                        $validator->errors()->add("segments.{$index}.date", 'Tanggal kloter tidak boleh sudah lewat.');
                    }
                    if ($date->gt($maxDate)) {
                        $validator->errors()->add("segments.{$index}.date", 'Tanggal kloter maksimal 2 bulan dari hari ini.');
                    }

                    $startsAt = Carbon::createFromFormat('Y-m-d H.i', $segment['date'].' '.$segment['time'], 'Asia/Jakarta');
                    if ($startsAt->lte(now('Asia/Jakarta'))) {
                        $validator->errors()->add("segments.{$index}.time", 'Jam kloter harus berada setelah waktu saat ini.');
                    }
                }

                $requiresConfirmation = $this->boolean('allowOverbook')
                    || $this->boolean('correctGroupSize');
                if ($requiresConfirmation && ! $this->boolean('confirmRisk')) {
                    $validator->errors()->add('confirmRisk', 'Konfirmasi perubahan berisiko wajib dicentang.');
                }
            },
        ];
    }
}
