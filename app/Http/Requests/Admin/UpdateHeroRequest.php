<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class UpdateHeroRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isOperator() ?? false;
    }

    public function rules(): array
    {
        return [
            'headline' => ['required', 'string', 'max:160'],
            'subheadline' => ['required', 'string', 'max:255'],
            'primaryCta' => ['required', 'string', 'max:48'],
            'secondaryCta' => ['required', 'string', 'max:48'],
            'story' => ['required', 'string', 'max:255'],
        ];
    }
}
