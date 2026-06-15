<?php

namespace App\Http\Requests\Admin;

use App\Rules\VisitTime;
use Carbon\Carbon;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreShortNoticeSlotRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isOperator() ?? false;
    }

    public function rules(): array
    {
        $today = Carbon::today('Asia/Jakarta');

        return [
            'date' => ['required', 'date_format:Y-m-d', 'after_or_equal:'.$today->toDateString(), 'before_or_equal:'.$today->copy()->addDay()->toDateString()],
            'time' => ['required', 'string', 'regex:/^\d{2}\.\d{2}$/', new VisitTime],
            'audience' => ['required', Rule::in(['admin', 'public'])],
            'closesAt' => ['nullable', 'date'],
            'capacity' => ['required', 'integer', 'min:1', 'max:560'],
            'note' => ['required', 'string', 'max:255'],
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
                    $validator->errors()->add('time', 'Jam dadakan harus berada setelah waktu saat ini.');
                }

                if ($this->input('audience') !== 'public') {
                    return;
                }

                if (! $this->filled('closesAt')) {
                    $validator->errors()->add('closesAt', 'Batas waktu booking publik wajib diisi.');

                    return;
                }

                $closesAt = Carbon::parse($this->input('closesAt'), 'Asia/Jakarta');
                if ($closesAt->lte(now('Asia/Jakarta')) || $closesAt->gte($startsAt)) {
                    $validator->errors()->add('closesAt', 'Batas booking harus setelah waktu saat ini dan sebelum jam kunjungan.');
                }
            },
        ];
    }

    public function messages(): array
    {
        return [
            'date.before_or_equal' => 'Booking dadakan hanya dapat dibuka untuk hari ini atau besok.',
        ];
    }
}
