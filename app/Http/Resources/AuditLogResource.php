<?php

namespace App\Http\Resources;

use App\Services\IndonesianDate;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AuditLogResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'actor' => $this->actor_name ?? $this->actor?->name,
            'action' => $this->action,
            'ipAddress' => $this->ip_address,
            'userAgent' => $this->user_agent,
            'at' => $this->created_at ? IndonesianDate::submittedAt($this->created_at) : null,
        ];
    }
}
