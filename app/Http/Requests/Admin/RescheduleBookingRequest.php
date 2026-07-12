<?php

namespace App\Http\Requests\Admin;

use App\Rules\VisitTime;
use Carbon\Carbon;
use Illuminate\Foundation\Http\FormRequest;

class RescheduleBookingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isOperator() ?? false;
    }

    public function rules(): array
    {
        $today = Carbon::today('Asia/Jakarta');

        return [
            'proposedDate' => [
                'required',
                'date_format:Y-m-d',
                'after_or_equal:'.$today->toDateString(),
                'before_or_equal:'.$today->copy()->addMonths(2)->toDateString(),
            ],
            'proposedTime' => ['required', 'string', 'regex:/^\d{2}\.\d{2}$/', new VisitTime],
            'allowOverbook' => ['sometimes', 'boolean'],
            'note' => ['nullable', 'string', 'max:2000'],
        ];
    }

    public function messages(): array
    {
        return [
            'proposedDate.after_or_equal' => 'Tanggal usulan tidak boleh sebelum hari ini.',
            'proposedDate.before_or_equal' => 'Tanggal usulan maksimal 2 bulan dari hari ini.',
        ];
    }
}
