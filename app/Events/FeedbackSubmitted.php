<?php

namespace App\Events;

use App\Http\Resources\FeedbackResource;
use App\Models\Feedback;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Broadcasting\ShouldRescue;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class FeedbackSubmitted implements ShouldBroadcast, ShouldRescue
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public bool $afterCommit = true;

    public function __construct(public Feedback $feedback) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('admin.bookings')];
    }

    public function broadcastAs(): string
    {
        return 'feedback.submitted';
    }

    public function broadcastWith(): array
    {
        return [
            'feedback' => (new FeedbackResource($this->feedback))->resolve(),
        ];
    }
}
