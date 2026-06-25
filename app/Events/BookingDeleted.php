<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Contracts\Broadcasting\ShouldRescue;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class BookingDeleted implements ShouldBroadcastNow, ShouldRescue
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public bool $afterCommit = true;

    /**
     * @param  array<int, string>  $dates
     */
    public function __construct(
        public readonly string $code,
        public readonly array $dates = [],
    ) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('admin.bookings')];
    }

    public function broadcastAs(): string
    {
        return 'booking.deleted';
    }

    public function broadcastWith(): array
    {
        return [
            'code' => $this->code,
            'dates' => $this->dates,
        ];
    }
}
