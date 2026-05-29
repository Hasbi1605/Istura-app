<?php

namespace App\Events;

use App\Http\Resources\BookingResource;
use App\Models\Booking;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class BookingStatusChanged implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Booking $booking,
        public string $previousStatus,
        public ?string $action = null,
    ) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('admin.bookings')];
    }

    public function broadcastAs(): string
    {
        return 'booking.status-changed';
    }

    public function broadcastWith(): array
    {
        return [
            'booking' => (new BookingResource($this->booking))->resolve(),
            'previousStatus' => $this->previousStatus,
            'action' => $this->action,
        ];
    }
}
