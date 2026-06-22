<?php

namespace App\Http\Controllers\Public;

use App\Events\FeedbackSubmitted;
use App\Http\Controllers\Controller;
use App\Http\Requests\Public\StoreFeedbackRequest;
use App\Http\Resources\FeedbackResource;
use App\Models\Booking;
use App\Models\Feedback;
use App\Services\AuditLogger;
use App\Services\IndonesianDate;
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

        $feedbackCount = $booking->feedbacks()->count();
        $accessStatus = $booking->feedbackAccessStatus($feedbackCount);

        return response()->json([
            'data' => null, // Never expose other people's feedback
            'booking' => [
                'code' => $booking->code,
                'institution' => $booking->institution,
                'dateLabel' => $booking->date_label,
                'status' => $booking->status,
            ],
            'feedback' => [
                'accessStatus' => $accessStatus,
                'submittedCount' => $feedbackCount,
                'limit' => $booking->feedbackLimit(),
                'expiresAt' => $booking->feedback_expires_at
                    ? IndonesianDate::submittedAt($booking->feedback_expires_at)
                    : null,
            ],
        ]);
    }

    public function store(StoreFeedbackRequest $request, string $code): JsonResponse
    {
        $payload = $request->validated();

        $feedback = DB::transaction(function () use ($code, $payload, $request) {
            $booking = Booking::where('code', $code)->lockForUpdate()->first();

            $this->ensureValidFeedbackToken($booking, (string) $payload['token']);

            if ($booking->status !== 'Completed') {
                throw ValidationException::withMessages([
                    'code' => ['Feedback baru dapat dikirim setelah kunjungan selesai.'],
                ]);
            }

            // Cek expiry: token kedaluwarsa 14 hari setelah completed
            if ($booking->isFeedbackExpired()) {
                throw ValidationException::withMessages([
                    'code' => ['Periode feedback telah berakhir.'],
                ]);
            }

            // Cek kuota: jumlah feedback tidak boleh melebihi group_size
            $currentCount = $booking->feedbacks()->count();
            if ($currentCount >= $booking->feedbackLimit()) {
                throw ValidationException::withMessages([
                    'code' => ['Kuota feedback sudah terpenuhi.'],
                ]);
            }

            // "Kepuasan keseluruhan" tidak lagi diisi pengunjung; diturunkan
            // dari rata-rata empat dimensi penilaian agar dashboard/laporan
            // yang masih memakai `rating` tetap konsisten.
            $rating = (int) round((
                $payload['bookingEase']
                + $payload['service']
                + $payload['guideQuality']
                + $payload['facilityComfort']
            ) / 4);
            $rating = max(1, min(5, $rating));

            $feedback = Feedback::create([
                'booking_id' => $booking->id,
                'code' => $booking->code,
                'visitor_name' => $payload['visitorName'],
                'gender' => $payload['gender'],
                'age' => $payload['age'],
                'origin' => $payload['origin'],
                'rating' => $rating,
                'booking_ease' => $payload['bookingEase'],
                'service' => $payload['service'],
                'guide_quality' => $payload['guideQuality'],
                'facility_comfort' => $payload['facilityComfort'],
                'recommend' => $payload['recommend'],
                'visited_before' => (bool) $payload['visitedBefore'],
                'discovery_source' => $payload['discoverySource'],
                'discovery_source_other' => $payload['discoverySourceOther'] ?? null,
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
                'submission_number' => $currentCount + 1,
                'quota' => $booking->feedbackLimit(),
            ], $request);

            return $feedback;
        });

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
}
