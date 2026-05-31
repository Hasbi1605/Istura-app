<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Broadcasting\ShouldRescue;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ScheduleUpdated implements ShouldBroadcast, ShouldRescue
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public bool $afterCommit = true;

    public function __construct(
        public readonly string $from,
        public readonly string $to,
    ) {}

    public function broadcastOn(): array
    {
        return [new Channel('public.schedule')];
    }

    public function broadcastAs(): string
    {
        return 'schedule.updated';
    }

    public function broadcastWith(): array
    {
        return [
            'from' => $this->from,
            'to' => $this->to,
        ];
    }
}
