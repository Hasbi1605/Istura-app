<?php

namespace App\Http\Requests\Admin;

use App\Models\ScheduleOverride;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreScheduleRangeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isAdmin() ?? false;
    }

    public function rules(): array
    {
        return [
            'from' => ['required', 'date_format:Y-m-d'],
            'to' => ['required', 'date_format:Y-m-d', 'after_or_equal:from'],
            'weekdays' => ['nullable', 'array'],
            'weekdays.*' => ['integer', 'min:0', 'max:6'],
            'time' => ['nullable', 'string', 'regex:/^\d{2}\.\d{2}$/'],
            'status' => ['required', Rule::in(ScheduleOverride::STATUSES)],
            'note' => ['nullable', 'string', 'max:255'],
        ];
    }
}
