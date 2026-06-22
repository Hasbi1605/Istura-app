<?php

namespace App\Http\Resources;

use App\Services\IndonesianDate;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class FeedbackResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        // Identitas pengunjung (nama/jenis kelamin/usia/asal) hanya untuk admin.
        // Path publik (show/broadcast) tidak boleh membocorkan data pribadi.
        $includeIdentity = (bool) $request->user();

        return [
            'id' => (int) $this->id,
            'code' => $this->code,
            $this->mergeWhen($includeIdentity, fn () => [
                'visitorName' => $this->visitor_name,
                'gender' => $this->gender,
                'age' => $this->age !== null ? (int) $this->age : null,
                'origin' => $this->origin,
            ]),
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
