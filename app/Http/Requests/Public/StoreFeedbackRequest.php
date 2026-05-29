<?php

namespace App\Http\Requests\Public;

use Illuminate\Foundation\Http\FormRequest;

class StoreFeedbackRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'token' => ['required', 'string'],
            'rating' => ['required', 'integer', 'min:1', 'max:5'],
            'bookingEase' => ['required', 'integer', 'min:1', 'max:5'],
            'service' => ['required', 'integer', 'min:1', 'max:5'],
            'recommend' => ['required', 'integer', 'min:1', 'max:5'],
            'highlights' => ['array'],
            'highlights.*' => ['string'],
            'improvements' => ['array'],
            'improvements.*' => ['string'],
            'comment' => ['nullable', 'string', 'max:2000'],
            'allowPublish' => ['required', 'boolean'],
        ];
    }
}
