<?php

namespace App\Http\Resources;

use App\Services\IndonesianDate;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OpenFeedbackResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (int) $this->id,
            'dayId' => (int) $this->open_event_day_id,
            'dayDate' => $this->day?->date?->toDateString(),
            'visitorName' => $this->visitor_name,
            'gender' => $this->gender,
            'age' => $this->age !== null ? (int) $this->age : null,
            'origin' => $this->origin,
            // Admin path only (Istura Open admin already sees full NIK).
            'nik' => $this->nik,
            'whatsapp' => $this->whatsapp,
            'rating' => (int) $this->rating,
            'bookingEase' => (int) $this->booking_ease,
            'service' => (int) $this->service,
            'guideQuality' => $this->guide_quality !== null ? (int) $this->guide_quality : null,
            'facilityComfort' => $this->facility_comfort !== null ? (int) $this->facility_comfort : null,
            'recommend' => (int) $this->recommend,
            'visitedBefore' => $this->visited_before !== null ? (bool) $this->visited_before : null,
            'discoverySource' => $this->discovery_source,
            'discoverySourceOther' => $this->discovery_source_other,
            'highlights' => $this->highlights ?? [],
            'improvements' => $this->improvements ?? [],
            'comment' => $this->comment,
            'allowPublish' => (bool) $this->allow_publish,
            'submittedAt' => $this->submitted_at ? IndonesianDate::submittedAt($this->submitted_at) : null,
        ];
    }
}
