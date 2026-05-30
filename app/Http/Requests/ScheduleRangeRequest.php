<?php

namespace App\Http\Requests;

use Carbon\Carbon;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class ScheduleRangeRequest extends FormRequest
{
    private const MAX_RANGE_DAYS = 93;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($validator->errors()->isNotEmpty()) {
                    return;
                }

                $from = $this->input('from')
                    ? Carbon::createFromFormat('Y-m-d', $this->input('from'), 'Asia/Jakarta')->startOfDay()
                    : Carbon::today('Asia/Jakarta');
                $to = $this->input('to')
                    ? Carbon::createFromFormat('Y-m-d', $this->input('to'), 'Asia/Jakarta')->startOfDay()
                    : $from->copy()->addMonths(2);

                if ($from->diffInDays($to) > self::MAX_RANGE_DAYS) {
                    $validator->errors()->add('to', 'Rentang jadwal maksimal 93 hari.');
                }
            },
        ];
    }

    public function startDate(): Carbon
    {
        return $this->validated('from')
            ? Carbon::createFromFormat('Y-m-d', $this->validated('from'), 'Asia/Jakarta')->startOfDay()
            : Carbon::today('Asia/Jakarta');
    }

    public function endDate(): Carbon
    {
        return $this->validated('to')
            ? Carbon::createFromFormat('Y-m-d', $this->validated('to'), 'Asia/Jakarta')->startOfDay()
            : $this->startDate()->copy()->addMonths(2);
    }
}
