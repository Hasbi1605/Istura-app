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
        return $this->user()?->isAdmin() ?? false;
    }

    public function rules(): array
    {
        return [
            'segments' => ['required', 'array', 'min:1', 'max:7'],
            'segments.*.date' => ['required', 'date_format:Y-m-d'],
            'segments.*.time' => ['required', 'string', 'regex:/^\d{2}\.\d{2}$/', new VisitTime],
            'segments.*.groupSize' => ['required', 'integer', 'min:1', 'max:560'],
            'allowOverbook' => ['sometimes', 'boolean'],
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
                $groupedSizes = [];
                foreach ($this->input('segments', []) as $index => $segment) {
                    $key = ($segment['date'] ?? '').'|'.($segment['time'] ?? '');
                    $groupedSizes[$key] = ($groupedSizes[$key] ?? 0) + (int) ($segment['groupSize'] ?? 0);

                    $date = Carbon::createFromFormat('Y-m-d', $segment['date'], 'Asia/Jakarta')->startOfDay();
                    if ($date->lt($today)) {
                        $validator->errors()->add("segments.{$index}.date", 'Tanggal kloter tidak boleh sudah lewat.');
                    }
                    if ($date->gt($maxDate)) {
                        $validator->errors()->add("segments.{$index}.date", 'Tanggal kloter maksimal 2 bulan dari hari ini.');
                    }
                }

                $requiresNote = $this->boolean('allowOverbook') || collect($groupedSizes)->contains(fn (int $size): bool => $size > 80);
                if ($requiresNote && trim((string) $this->input('note', '')) === '') {
                    $validator->errors()->add('note', 'Catatan wajib diisi saat mengizinkan overbook atau menggabungkan kloter besar.');
                }
            },
        ];
    }
}
