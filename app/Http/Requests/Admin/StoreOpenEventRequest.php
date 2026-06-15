<?php

namespace App\Http\Requests\Admin;

use App\Models\OpenEvent;
use Carbon\Carbon;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreOpenEventRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->isOperator();
    }

    public function rules(): array
    {
        $today = Carbon::today('Asia/Jakarta')->toDateString();

        return [
            'name' => ['required', 'string', 'max:150'],
            'dates' => ['sometimes', 'array', 'min:1', 'max:366'],
            'dates.*' => ['required', 'date_format:Y-m-d', 'distinct', 'after_or_equal:'.$today],
            'startDate' => ['required_without:dates', 'date_format:Y-m-d', 'after_or_equal:'.$today],
            'endDate' => ['required_without:dates', 'date_format:Y-m-d', 'after_or_equal:startDate'],
            'perDayQuota' => ['required', 'integer', 'min:1', 'max:100000'],
            'maxAddons' => ['required', 'integer', 'min:0', 'max:50'],
            'assignmentMode' => ['sometimes', Rule::in(OpenEvent::ASSIGNMENT_MODES)],
            'releaseMode' => ['sometimes', Rule::in(OpenEvent::RELEASE_MODES)],
            'registrationOpensAt' => ['nullable', 'date'],
            'registrationClosesAt' => ['nullable', 'date', 'after_or_equal:registrationOpensAt'],
            'agreementText' => ['nullable', 'string', 'max:5000'],
            'promoSubtitle' => ['nullable', 'string', 'max:255'],
            'bannerText' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return [
            'endDate.after_or_equal' => 'Tanggal akhir harus sama atau setelah tanggal mulai.',
            'dates.min' => 'Pilih minimal satu tanggal event.',
            'dates.*.distinct' => 'Tanggal event tidak boleh duplikat.',
            'dates.*.after_or_equal' => 'Tanggal event tidak boleh sudah lewat.',
            'startDate.after_or_equal' => 'Tanggal mulai event tidak boleh sudah lewat.',
        ];
    }
}
