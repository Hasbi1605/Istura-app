<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UpdateSchedulePolicyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isOperator() ?? false;
    }

    public function rules(): array
    {
        return [
            'openWeekdays' => ['required', 'array', 'min:1', 'max:7'],
            'openWeekdays.*' => ['integer', 'distinct', 'min:0', 'max:6'],
            'closedLabels' => ['nullable', 'array'],
            'closedLabels.*' => ['nullable', 'string', 'max:80'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($validator->errors()->isNotEmpty()) {
                    return;
                }

                foreach (array_keys((array) $this->input('closedLabels', [])) as $key) {
                    if (! is_numeric($key) || (int) $key < 0 || (int) $key > 6) {
                        $validator->errors()->add('closedLabels', 'Label alasan tutup hanya boleh untuk hari 0 sampai 6.');
                    }
                }
            },
        ];
    }

    public function messages(): array
    {
        return [
            'openWeekdays.min' => 'Minimal satu hari operasional harus dipilih.',
            'openWeekdays.*.distinct' => 'Hari operasional tidak boleh duplikat.',
            'closedLabels.*.max' => 'Alasan tutup maksimal 80 karakter.',
        ];
    }
}
