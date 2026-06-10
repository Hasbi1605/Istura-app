<?php

namespace App\Http\Requests\Admin;

use App\Models\OpenEvent;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreOpenEventRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->isAdmin();
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:150'],
            'startDate' => ['required', 'date_format:Y-m-d'],
            'endDate' => ['required', 'date_format:Y-m-d', 'after_or_equal:startDate'],
            'perDayQuota' => ['required', 'integer', 'min:1', 'max:100000'],
            'maxAddons' => ['required', 'integer', 'min:0', 'max:50'],
            'assignmentMode' => ['sometimes', Rule::in(OpenEvent::ASSIGNMENT_MODES)],
            'releaseMode' => ['sometimes', Rule::in(OpenEvent::RELEASE_MODES)],
            'registrationOpensAt' => ['nullable', 'date'],
            'registrationClosesAt' => ['nullable', 'date', 'after_or_equal:registrationOpensAt'],
            'agreementText' => ['nullable', 'string', 'max:5000'],
        ];
    }

    public function messages(): array
    {
        return [
            'endDate.after_or_equal' => 'Tanggal akhir harus sama atau setelah tanggal mulai.',
        ];
    }
}
