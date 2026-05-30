<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\User;

class AuditLogger
{
    public static function record(
        ?User $actor,
        string $action,
        ?string $targetType = null,
        string|int|null $targetId = null,
        array $payload = [],
    ): AuditLog {
        return AuditLog::create([
            'actor_id' => $actor?->id,
            'actor_name' => $actor?->name ?? 'Sistem',
            'action' => $action,
            'target_type' => $targetType,
            'target_id' => $targetId !== null ? (string) $targetId : null,
            'payload' => $payload === [] ? null : $payload,
            'created_at' => now(),
        ]);
    }
}
