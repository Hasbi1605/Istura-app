<?php

namespace App\Http\Resources;

use App\Services\IndonesianDate;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Mirror dari type Booking di src/App.tsx — properti camelCase agar drop-in
 * untuk frontend tanpa perlu transformer ekstra.
 */
class BookingResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $leadTimeDays = $this->leadTimeDays();

        return [
            'code' => $this->code,
            'contactName' => $this->contact_name,
            'nik' => $this->when($this->shouldExposeNik($request), fn () => $this->nik),
            'nikMasked' => $this->nik_masked,
            'whatsapp' => $this->whatsapp,
            'institution' => $this->institution,
            'groupSize' => (int) $this->group_size,
            'kloterCount' => count($this->segments()),
            'segments' => $this->segments(),
            'date' => $this->date?->toDateString(),
            'dateLabel' => $this->date_label,
            'time' => $this->time,
            'status' => $this->status,
            'documentName' => $this->document_original_name,
            'hasDocument' => (bool) $this->document_path,
            'submittedAt' => $this->submitted_at ? IndonesianDate::submittedAt($this->submitted_at) : null,
            'leadTimeDays' => $leadTimeDays,
            'isShortNotice' => $leadTimeDays !== null && $leadTimeDays >= 0 && $leadTimeDays < 5,
            'note' => $this->note,
            'feedbackToken' => $this->when($this->shouldExposeFeedbackToken($request), fn () => $this->feedback_token),
            'completedAt' => $this->completed_at ? IndonesianDate::submittedAt($this->completed_at) : null,
            'proposedDate' => $this->proposed_date?->toDateString(),
            'proposedDateLabel' => $this->proposed_date_label,
            'proposedTime' => $this->proposed_time,
            'proposedSegments' => $this->proposedSegments(),
            'proposedAt' => $this->proposed_at ? IndonesianDate::submittedAt($this->proposed_at) : null,
        ];
    }

    private function segments(): array
    {
        $slots = ($this->relationLoaded('slots') ? $this->slots : $this->slots()->get())
            ->where('kind', 'active')
            ->values();
        if ($slots->isEmpty()) {
            return [[
                'order' => 1,
                'date' => $this->date?->toDateString(),
                'dateLabel' => $this->date_label,
                'time' => $this->time,
                'groupSize' => (int) $this->group_size,
            ]];
        }

        return $slots->map(fn ($slot) => [
            'order' => (int) $slot->slot_order,
            'date' => $slot->date?->toDateString(),
            'dateLabel' => $slot->date_label,
            'time' => $slot->time,
            'groupSize' => (int) $slot->group_size,
        ])->values()->all();
    }

    private function proposedSegments(): ?array
    {
        if (! $this->proposed_segments) {
            return null;
        }

        return collect($this->proposed_segments)->map(fn (array $slot) => [
            'order' => (int) ($slot['slot_order'] ?? $slot['order'] ?? 1),
            'date' => $slot['date'] ?? null,
            'dateLabel' => $slot['date_label'] ?? $slot['dateLabel'] ?? null,
            'time' => $slot['time'] ?? null,
            'groupSize' => (int) ($slot['group_size'] ?? $slot['groupSize'] ?? 0),
        ])->values()->all();
    }

    private function shouldExposeNik(Request $request): bool
    {
        return (bool) $request->user()?->isSuperAdmin()
            && $request->isMethod('GET')
            && $request->is('api/admin/bookings/*')
            && ! $request->is('api/admin/bookings/*/*');
    }

    private function shouldExposeFeedbackToken(Request $request): bool
    {
        return (bool) $request->user()?->isAdmin()
            && $request->is('api/admin/*');
    }

    private function leadTimeDays(): ?int
    {
        if (! $this->date || ! $this->submitted_at) {
            return null;
        }

        $visitDate = $this->date->copy()->timezone('Asia/Jakarta')->startOfDay();
        $submittedDate = $this->submitted_at->copy()->timezone('Asia/Jakarta')->startOfDay();

        return (int) floor(($visitDate->getTimestamp() - $submittedDate->getTimestamp()) / 86400);
    }
}
