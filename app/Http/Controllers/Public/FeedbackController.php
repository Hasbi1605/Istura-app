<?php

namespace App\Http\Controllers\Public;

use App\Events\FeedbackSubmitted;
use App\Http\Controllers\Controller;
use App\Http\Requests\Public\StoreFeedbackRequest;
use App\Http\Resources\FeedbackResource;
use App\Models\Booking;
use App\Models\Feedback;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;

class FeedbackController extends Controller
{
    public function show(string $code): JsonResponse
    {
        $booking = Booking::where('code', $code)->firstOrFail();
        $feedback = $booking->feedback;

        return response()->json([
            'data' => $feedback ? (new FeedbackResource($feedback))->resolve() : null,
            'booking' => [
                'code' => $booking->code,
                'institution' => $booking->institution,
                'dateLabel' => $booking->date_label,
            ],
        ]);
    }

    public function store(StoreFeedbackRequest $request, string $code): JsonResponse
    {
        $booking = Booking::where('code', $code)->firstOrFail();
        $payload = $request->validated();

        if (! hash_equals($booking->feedback_token, (string) $payload['token'])) {
            throw ValidationException::withMessages([
                'token' => ['Token feedback tidak valid.'],
            ]);
        }

        if ($booking->feedback) {
            throw ValidationException::withMessages([
                'code' => ['Feedback untuk kode ini sudah pernah dikirim.'],
            ]);
        }

        $feedback = Feedback::create([
            'booking_id' => $booking->id,
            'code' => $booking->code,
            'rating' => $payload['rating'],
            'booking_ease' => $payload['bookingEase'],
            'service' => $payload['service'],
            'recommend' => $payload['recommend'],
            'highlights' => $payload['highlights'] ?? [],
            'improvements' => $payload['improvements'] ?? [],
            'comment' => $payload['comment'] ?? null,
            'allow_publish' => (bool) $payload['allowPublish'],
            'submitted_at' => now(),
        ]);

        FeedbackSubmitted::dispatch($feedback->fresh());

        return response()->json([
            'data' => (new FeedbackResource($feedback))->resolve(),
        ], 201);
    }
}
