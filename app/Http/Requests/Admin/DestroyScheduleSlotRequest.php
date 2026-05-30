<?php

namespace App\Http\Requests\Admin;

use App\Rules\VisitTime;
use Illuminate\Foundation\Http\FormRequest;

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
}
