<?php

namespace App\Http\Requests\Admin;

use App\Rules\VisitTime;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UpdateBookingSegmentsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isAdmin() ?? false;
    }

    public function rules(): array
    {
        return [
            'segments' => ['required', 'array', 'min:1', 'max:7'],
            'segments.*.date' => ['required', 'date_format:Y-m-d'],
            'segments.*.time' => ['required', 'string', 'regex:/^\d{2}\.\d{2}$/', new VisitTime],
            'segments.*.groupSize' => ['required', 'integer', 'min:1', 'max:560'],
            'note' => ['nullable', 'string', 'max:2000'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($validator->errors()->isNotEmpty()) {
                    return;
                }

                $seen = [];
                foreach ($this->input('segments', []) as $index => $segment) {
                    $key = ($segment['date'] ?? '').'|'.($segment['time'] ?? '');
                    if (isset($seen[$key])) {
                        $validator->errors()->add("segments.{$index}.time", 'Tanggal dan jam kloter tidak boleh duplikat.');
                    }
                    $seen[$key] = true;
                }
            },
        ];
    }
}
