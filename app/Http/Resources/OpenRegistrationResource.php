<?php

namespace App\Http\Resources;

use App\Models\OpenRegistration;
use App\Services\IndonesianDate;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property-read OpenRegistration $resource
 */
class OpenRegistrationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $members = is_array($this->members) ? array_values($this->members) : [];

        return [
            'code' => $this->code,
            'contactName' => $this->contact_name,
            'nik' => $this->when($this->shouldExposeNik($request), fn () => $this->nik),
            'nikMasked' => $this->nik_masked,
            'whatsapp' => $this->whatsapp,
            'city' => $this->city,
            'members' => $members,
            'addonCount' => count($members),
            'headcount' => (int) $this->headcount,
            'status' => $this->status,
            'dayId' => $this->assigned_event_day_id,
            'dayDate' => $this->whenLoaded('day', fn () => $this->day?->date?->toDateString()),
            'registeredAt' => $this->registered_at ? IndonesianDate::submittedAt($this->registered_at) : null,
            'cancelledAt' => $this->cancelled_at ? IndonesianDate::submittedAt($this->cancelled_at) : null,
        ];
    }

    private function shouldExposeNik(Request $request): bool
    {
        return (bool) $request->user()?->isAdmin()
            && $request->is('api/admin/open-events/*');
    }
}
