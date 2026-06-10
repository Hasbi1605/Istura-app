<?php

namespace App\Http\Requests\Admin;

use App\Models\OpenEvent;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateOpenEventRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->isAdmin();
    }

    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'required', 'string', 'max:150'],
            'startDate' => ['sometimes', 'required', 'date_format:Y-m-d'],
            'endDate' => ['sometimes', 'required', 'date_format:Y-m-d', 'after_or_equal:startDate'],
            'perDayQuota' => ['sometimes', 'required', 'integer', 'min:1', 'max:100000'],
            'maxAddons' => ['sometimes', 'required', 'integer', 'min:0', 'max:50'],
            'assignmentMode' => ['sometimes', Rule::in(OpenEvent::ASSIGNMENT_MODES)],
            'releaseMode' => ['sometimes', Rule::in(OpenEvent::RELEASE_MODES)],
            'registrationOpensAt' => ['sometimes', 'nullable', 'date'],
            'registrationClosesAt' => ['sometimes', 'nullable', 'date', 'after_or_equal:registrationOpensAt'],
            'agreementText' => ['sometimes', 'nullable', 'string', 'max:5000'],
        ];
    }
}
