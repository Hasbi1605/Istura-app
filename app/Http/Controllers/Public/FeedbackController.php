<?php

namespace App\Http\Controllers\Public;

use App\Events\FeedbackSubmitted;
use App\Http\Controllers\Controller;
use App\Http\Requests\Public\StoreFeedbackRequest;
use App\Http\Resources\FeedbackResource;
use App\Models\Booking;
use App\Models\Feedback;
use App\Services\AuditLogger;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class FeedbackController extends Controller
{
    public function show(Request $request, string $code): JsonResponse
    {
        $booking = Booking::where('code', $code)->first();
        $token = (string) $request->query('token', '');

        $this->ensureValidFeedbackToken($booking, $token);

        $feedback = $booking->feedback;

        return response()->json([
            'data' => $feedback ? (new FeedbackResource($feedback))->resolve() : null,
            'booking' => [
                'code' => $booking->code,
                'institution' => $booking->institution,
                'dateLabel' => $booking->date_label,
                'status' => $booking->status,
            ],
        ]);
    }

    public function store(StoreFeedbackRequest $request, string $code): JsonResponse
    {
        $payload = $request->validated();

        try {
            $feedback = DB::transaction(function () use ($code, $payload, $request) {
                $booking = Booking::where('code', $code)->lockForUpdate()->first();

                $this->ensureValidFeedbackToken($booking, (string) $payload['token']);

                if ($booking->status !== 'Completed') {
                    throw ValidationException::withMessages([
                        'code' => ['Feedback baru dapat dikirim setelah kunjungan selesai.'],
                    ]);
                }

                if ($booking->feedback()->exists()) {
                    $this->throwDuplicateFeedback();
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

                AuditLogger::record(null, "Feedback dikirim untuk booking {$booking->code}", Feedback::class, $feedback->id, [
                    'booking_code' => $booking->code,
                    'rating' => $feedback->rating,
                    'allow_publish' => $feedback->allow_publish,
                ], $request);

                return $feedback;
            });
        } catch (QueryException $exception) {
            if ($this->isDuplicateFeedbackConflict($exception)) {
                $this->throwDuplicateFeedback();
            }

            throw $exception;
        }

        FeedbackSubmitted::dispatch($feedback->fresh());

        return response()->json([
            'data' => (new FeedbackResource($feedback))->resolve(),
        ], 201);
    }

    private function ensureValidFeedbackToken(?Booking $booking, string $token): void
    {
        if (! $booking || $token === '' || ! hash_equals($booking->feedback_token, $token)) {
            throw ValidationException::withMessages([
                'token' => ['Kode atau token feedback tidak valid.'],
            ]);
        }
    }

    private function throwDuplicateFeedback(): never
    {
        throw ValidationException::withMessages([
            'code' => ['Feedback untuk kode ini sudah pernah dikirim.'],
        ]);
    }

    private function isDuplicateFeedbackConflict(QueryException $exception): bool
    {
        $message = $exception->getMessage();

        return in_array((string) $exception->getCode(), ['23000', '23505'], true)
            && (str_contains($message, 'feedbacks_booking_id_unique')
                || str_contains($message, 'feedbacks_code_unique')
                || str_contains($message, 'feedbacks.booking_id')
                || str_contains($message, 'feedbacks.code'));
    }
}
