<?php

namespace App\Http\Requests\Public;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

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
            'guideQuality' => ['required', 'integer', 'min:1', 'max:5'],
            'facilityComfort' => ['required', 'integer', 'min:1', 'max:5'],
            'recommend' => ['required', 'integer', 'min:1', 'max:5'],
            'visitedBefore' => ['required', 'boolean'],
            'discoverySource' => [
                'required',
                'string',
                Rule::in([
                    'social_media',
                    'friends_family',
                    'school_institution',
                    'web_search',
                    'previous_visit',
                    'other',
                ]),
            ],
            'discoverySourceOther' => ['exclude_unless:discoverySource,other', 'required', 'string', 'max:120'],
            'highlights' => ['array', 'max:12'],
            'highlights.*' => ['string', 'max:80', 'distinct'],
            'improvements' => ['array', 'max:12'],
            'improvements.*' => ['string', 'max:80', 'distinct'],
            'comment' => ['nullable', 'string', 'max:2000'],
            'allowPublish' => ['required', 'boolean'],
        ];
    }
}
