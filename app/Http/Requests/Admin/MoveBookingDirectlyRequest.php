<?php

namespace App\Http\Requests\Admin;

use App\Rules\VisitTime;
use Carbon\Carbon;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class MoveBookingDirectlyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isOperator() ?? false;
    }

    public function rules(): array
    {
        $today = Carbon::today('Asia/Jakarta');

        return [
            'date' => ['required', 'date_format:Y-m-d', 'after_or_equal:'.$today->toDateString(), 'before_or_equal:'.$today->copy()->addMonths(2)->toDateString()],
            'time' => ['required', 'string', 'regex:/^\d{2}\.\d{2}$/', new VisitTime],
            'allowOverbook' => ['sometimes', 'boolean'],
            'note' => ['required', 'string', 'max:2000'],
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
                    $validator->errors()->add('time', 'Jam tujuan harus berada setelah waktu saat ini.');
                }
            },
        ];
    }
}
