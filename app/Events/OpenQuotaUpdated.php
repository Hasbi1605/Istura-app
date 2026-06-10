<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Contracts\Broadcasting\ShouldRescue;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Public broadcast fired whenever an Istura Open registration is created,
 * cancelled, or moved. Clients refetch the per-day remaining quota.
 */
class OpenQuotaUpdated implements ShouldBroadcastNow, ShouldRescue
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public bool $afterCommit = true;

    public function __construct(
        public readonly string $eventSlug,
    ) {}

    public function broadcastOn(): array
    {
        return [new Channel('public.open')];
    }

    public function broadcastAs(): string
    {
        return 'open.quota-updated';
    }

    public function broadcastWith(): array
    {
        return [
            'eventSlug' => $this->eventSlug,
        ];
    }
}
