<?php

namespace App\Http\Resources;

use App\Models\OpenEventDay;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property-read OpenEventDay $resource
 */
class OpenEventDayResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $event = $this->resource->relationLoaded('event') ? $this->resource->event : null;
        $quota = $this->resource->effectiveQuota($event);

        return [
            'id' => $this->id,
            'date' => $this->date?->toDateString(),
            'quota' => $quota,
            'quotaOverride' => $this->quota_override,
            'isOpen' => (bool) $this->is_open,
            'opensAt' => $this->opens_at?->toIso8601String(),
            // WhatsApp link is admin-only; never leak to public surfaces.
            'whatsappGroupUrl' => $this->when($this->isAdminRequest($request), fn () => $this->whatsapp_group_url),
            'hasWhatsappGroupUrl' => (bool) $this->whatsapp_group_url,
            // Shared per-day feedback link (admin-only). One link per WhatsApp group.
            'feedbackUrl' => $this->when(
                $this->isAdminRequest($request),
                fn () => $this->feedback_token ? url('/feedback-open/'.$this->feedback_token) : null,
            ),
            'feedbackCount' => $this->when(
                $this->isAdminRequest($request),
                fn () => (int) ($this->feedbacks_count ?? $this->feedbacks()->count()),
            ),
        ];
    }

    private function isAdminRequest(Request $request): bool
    {
        return (bool) $request->user()?->isAdmin() && $request->is('api/admin/*');
    }
}
