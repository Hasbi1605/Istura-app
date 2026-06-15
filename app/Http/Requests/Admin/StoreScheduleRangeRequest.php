<?php

namespace App\Http\Requests\Admin;

use App\Rules\VisitTime;
use Carbon\Carbon;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreScheduleRangeRequest extends FormRequest
{
    private const MAX_RANGE_DAYS = 93;

    public function authorize(): bool
    {
        return $this->user()?->isOperator() ?? false;
    }

    public function rules(): array
    {
        return [
            'from' => ['required', 'date_format:Y-m-d'],
            'to' => ['required', 'date_format:Y-m-d', 'after_or_equal:from'],
            'weekdays' => ['nullable', 'array'],
            'weekdays.*' => ['integer', 'min:0', 'max:6'],
            'time' => ['nullable', 'string', 'regex:/^\d{2}\.\d{2}$/', new VisitTime],
            'status' => ['required', Rule::in(['Available', 'Closed'])],
            'note' => ['nullable', 'string', 'max:255'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($validator->errors()->isNotEmpty()) {
                    return;
                }

                $from = Carbon::createFromFormat('Y-m-d', $this->input('from'), 'Asia/Jakarta')->startOfDay();
                $to = Carbon::createFromFormat('Y-m-d', $this->input('to'), 'Asia/Jakarta')->startOfDay();

                if ($from->diffInDays($to) > self::MAX_RANGE_DAYS) {
                    $validator->errors()->add('to', 'Rentang jadwal maksimal 93 hari.');
                }

                if ($from->lt(Carbon::today('Asia/Jakarta'))) {
                    $validator->errors()->add('from', 'Tanggal awal jadwal tidak boleh sudah lewat.');
                }
            },
        ];
    }
}
