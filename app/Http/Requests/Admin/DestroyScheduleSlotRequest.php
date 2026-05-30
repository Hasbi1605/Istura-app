<?php

namespace App\Http\Requests\Admin;

use App\Rules\VisitTime;
use Carbon\Carbon;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class DestroyScheduleSlotRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isAdmin() ?? false;
    }

    public function rules(): array
    {
        return [
            'date' => ['required', 'date_format:Y-m-d'],
            'time' => ['required', 'string', 'regex:/^\d{2}\.\d{2}$/', new VisitTime],
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
                if ($date->lt(Carbon::today('Asia/Jakarta'))) {
                    $validator->errors()->add('date', 'Tanggal jadwal tidak boleh sudah lewat.');
                }
            },
        ];
    }
}
