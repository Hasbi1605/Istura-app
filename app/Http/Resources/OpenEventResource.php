<?php

namespace App\Http\Resources;

use App\Models\OpenEvent;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property-read OpenEvent $resource
 */
class OpenEventResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'startDate' => $this->start_date?->toDateString(),
            'endDate' => $this->end_date?->toDateString(),
            'perDayQuota' => (int) $this->per_day_quota,
            'maxAddons' => (int) $this->max_addons,
            'assignmentMode' => $this->assignment_mode,
            'releaseMode' => $this->release_mode,
            'registrationOpensAt' => $this->registration_opens_at?->toIso8601String(),
            'registrationClosesAt' => $this->registration_closes_at?->toIso8601String(),
            'agreementText' => $this->agreement_text,
            'posterUrl' => $this->resource->posterUrl(),
            'isActive' => (bool) $this->is_active,
            'days' => OpenEventDayResource::collection(
                $this->whenLoaded('days')
            ),
        ];
    }
}
