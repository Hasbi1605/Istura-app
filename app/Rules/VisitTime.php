<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

class VisitTime implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || ! preg_match('/^\d{2}\.\d{2}$/', $value)) {
            return;
        }

        [$hour, $minute] = array_map('intval', explode('.', $value, 2));

        if ($hour > 23 || $minute > 59) {
            $fail('Jam kunjungan harus memakai format HH.MM yang valid.');
        }
    }
}
