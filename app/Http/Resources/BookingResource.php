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
        return [
            'code' => $this->code,
            'contactName' => $this->contact_name,
            'nik' => $this->when($this->shouldExposeFullNik($request), fn () => $this->nik),
            'nikMasked' => $this->nik_masked,
            'whatsapp' => $this->whatsapp,
            'institution' => $this->institution,
            'groupSize' => (int) $this->group_size,
            'date' => $this->date?->toDateString(),
            'dateLabel' => $this->date_label,
            'time' => $this->time,
            'status' => $this->status,
            'documentName' => $this->document_original_name,
            'submittedAt' => $this->submitted_at ? IndonesianDate::submittedAt($this->submitted_at) : null,
            'note' => $this->note,
            'feedbackToken' => $this->feedback_token,
            'completedAt' => $this->completed_at ? IndonesianDate::submittedAt($this->completed_at) : null,
            'proposedDate' => $this->proposed_date?->toDateString(),
            'proposedDateLabel' => $this->proposed_date_label,
            'proposedTime' => $this->proposed_time,
            'proposedAt' => $this->proposed_at ? IndonesianDate::submittedAt($this->proposed_at) : null,
        ];
    }

    private function shouldExposeFullNik(Request $request): bool
    {
        $user = $request->user();

        return $user && $user->isSuperAdmin() && $request->routeIs('admin.bookings.show.full');
    }
}
