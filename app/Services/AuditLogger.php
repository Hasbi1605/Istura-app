<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class AuditLogger
{
    public static function record(
        ?User $actor,
        string $action,
        ?string $targetType = null,
        string|int|null $targetId = null,
        array $payload = [],
        ?Request $request = null,
    ): AuditLog {
        return AuditLog::create([
            'actor_id' => $actor?->id,
            'actor_name' => $actor?->name ?? 'Sistem',
            'action' => $action,
            'target_type' => $targetType,
            'target_id' => $targetId !== null ? (string) $targetId : null,
            'payload' => $payload === [] ? null : $payload,
            'ip_address' => $request?->ip(),
            'user_agent' => $request?->userAgent() ? Str::limit($request->userAgent(), 1000, '') : null,
            'created_at' => now(),
        ]);
    }
}
