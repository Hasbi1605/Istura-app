<?php

namespace App\Http\Requests\Admin;

use App\Models\OpenEvent;
use Carbon\Carbon;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateOpenEventRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->isOperator();
    }

    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'required', 'string', 'max:150'],
            'dates' => ['sometimes', 'array', 'min:1', 'max:366'],
            'dates.*' => ['required', 'date_format:Y-m-d', 'distinct'],
            'startDate' => ['sometimes', 'required', 'date_format:Y-m-d'],
            'endDate' => ['sometimes', 'required', 'date_format:Y-m-d', 'after_or_equal:startDate'],
            'perDayQuota' => ['sometimes', 'required', 'integer', 'min:1', 'max:100000'],
            'maxAddons' => ['sometimes', 'required', 'integer', 'min:0', 'max:50'],
            'assignmentMode' => ['sometimes', Rule::in(OpenEvent::ASSIGNMENT_MODES)],
            'releaseMode' => ['sometimes', Rule::in(OpenEvent::RELEASE_MODES)],
            'registrationOpensAt' => ['sometimes', 'nullable', 'date'],
            'registrationClosesAt' => ['sometimes', 'nullable', 'date', 'after_or_equal:registrationOpensAt'],
            'agreementText' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'promoSubtitle' => ['sometimes', 'nullable', 'string', 'max:255'],
            'bannerText' => ['sometimes', 'nullable', 'string', 'max:500'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($validator->errors()->isNotEmpty()) {
                    return;
                }

                if (! $this->hasAny(['dates', 'startDate', 'endDate'])) {
                    return;
                }

                $today = Carbon::today('Asia/Jakarta');
                $event = $this->route('event');
                $existingDates = $event instanceof OpenEvent
                    ? $event->days()->get(['date'])->map(fn ($day): string => $day->date->toDateString())->all()
                    : [];

                foreach ($this->input('dates', []) as $index => $date) {
                    $parsedDate = Carbon::createFromFormat('Y-m-d', $date, 'Asia/Jakarta')->startOfDay();
                    if ($parsedDate->lt($today) && ! in_array($date, $existingDates, true)) {
                        $validator->errors()->add("dates.{$index}", 'Tanggal event baru tidak boleh sudah lewat.');
                    }
                }

                foreach (['startDate' => 'start_date', 'endDate' => 'end_date'] as $input => $column) {
                    if (! $this->has($input)) {
                        continue;
                    }

                    $date = (string) $this->input($input);
                    $existingDate = $event instanceof OpenEvent ? $event->{$column}?->toDateString() : null;
                    $parsedDate = Carbon::createFromFormat('Y-m-d', $date, 'Asia/Jakarta')->startOfDay();
                    if ($parsedDate->lt($today) && $date !== $existingDate) {
                        $validator->errors()->add($input, 'Tanggal event baru tidak boleh sudah lewat.');
                    }
                }
            },
        ];
    }

    public function messages(): array
    {
        return [
            'endDate.after_or_equal' => 'Tanggal akhir harus sama atau setelah tanggal mulai.',
            'dates.min' => 'Pilih minimal satu tanggal event.',
            'dates.*.distinct' => 'Tanggal event tidak boleh duplikat.',
        ];
    }
}
