<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Http\Requests\Public\StoreOpenFeedbackRequest;
use App\Models\Booking;
use App\Models\OpenEventDay;
use App\Models\OpenFeedback;
use App\Services\AuditLogger;
use App\Services\IndonesianDate;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class OpenFeedbackController extends Controller
{
    /**
     * Public context for a shared per-day feedback link. Never exposes other
     * respondents' answers, the WhatsApp group link, or registrant data.
     */
    public function show(string $token): JsonResponse
    {
        $day = $this->resolveDay($token);
        $accessStatus = $day->feedbackAccessStatus();

        return response()->json([
            'data' => [
                'eventName' => $day->event?->name,
                'dayDate' => $day->date?->toDateString(),
                'dayDateLabel' => $day->date ? IndonesianDate::longDate($day->date) : null,
                'accessStatus' => $accessStatus,
                'closesAt' => $day->feedbackClosesAt()
                    ? IndonesianDate::longDate($day->feedbackClosesAt())
                    : null,
            ],
        ]);
    }

    public function store(StoreOpenFeedbackRequest $request, string $token): JsonResponse
    {
        $payload = $request->validated();

        $feedback = DB::transaction(function () use ($token, $payload, $request) {
            $day = OpenEventDay::where('feedback_token', $token)->lockForUpdate()->first();

            if (! $day) {
                throw ValidationException::withMessages([
                    'token' => ['Tautan feedback tidak valid.'],
                ]);
            }

            $status = $day->feedbackAccessStatus();
            if ($status === 'not_open_yet') {
                throw ValidationException::withMessages([
                    'token' => ['Feedback hari ini belum dibuka.'],
                ]);
            }
            if ($status === 'closed') {
                throw ValidationException::withMessages([
                    'token' => ['Periode feedback untuk hari ini telah berakhir.'],
                ]);
            }

            // Dedup: one submission per NIK and per phone for this day.
            $nikHash = Booking::identityHash($payload['nik']);
            $whatsappNormalized = Booking::normalizeWhatsapp($payload['whatsapp']);
            $alreadySubmitted = OpenFeedback::query()
                ->where('open_event_day_id', $day->id)
                ->where(function ($query) use ($nikHash, $whatsappNormalized) {
                    $query->where('nik_hash', $nikHash);
                    if ($whatsappNormalized) {
                        $query->orWhere('whatsapp_normalized', $whatsappNormalized);
                    }
                })
                ->exists();

            if ($alreadySubmitted) {
                throw ValidationException::withMessages([
                    'nik' => ['NIK atau nomor HP ini sudah mengisi feedback untuk hari ini.'],
                ]);
            }

            // "Kepuasan keseluruhan" tidak diisi pengunjung; diturunkan dari
            // rata-rata empat dimensi penilaian agar konsisten dengan rombongan.
            $rating = (int) round((
                $payload['bookingEase']
                + $payload['service']
                + $payload['guideQuality']
                + $payload['facilityComfort']
            ) / 4);
            $rating = max(1, min(5, $rating));

            $feedback = new OpenFeedback;
            $feedback->open_event_id = $day->open_event_id;
            $feedback->open_event_day_id = $day->id;
            $feedback->nik = $payload['nik'];
            $feedback->whatsapp = $payload['whatsapp'];
            $feedback->visitor_name = $payload['visitorName'];
            $feedback->gender = $payload['gender'];
            $feedback->age = $payload['age'];
            $feedback->origin = $payload['origin'];
            $feedback->rating = $rating;
            $feedback->booking_ease = $payload['bookingEase'];
            $feedback->service = $payload['service'];
            $feedback->guide_quality = $payload['guideQuality'];
            $feedback->facility_comfort = $payload['facilityComfort'];
            $feedback->recommend = $payload['recommend'];
            $feedback->visited_before = (bool) $payload['visitedBefore'];
            $feedback->discovery_source = $payload['discoverySource'];
            $feedback->discovery_source_other = $payload['discoverySourceOther'] ?? null;
            $feedback->highlights = $payload['highlights'] ?? [];
            $feedback->improvements = $payload['improvements'] ?? [];
            $feedback->comment = $payload['comment'] ?? null;
            $feedback->allow_publish = (bool) $payload['allowPublish'];
            $feedback->submitted_at = now();
            $feedback->save();

            AuditLogger::record(null, "Feedback Istura Open dikirim untuk hari {$day->date?->toDateString()}", OpenFeedback::class, $feedback->id, [
                'open_event_id' => $day->open_event_id,
                'open_event_day_id' => $day->id,
                'rating' => $feedback->rating,
                'allow_publish' => $feedback->allow_publish,
            ], $request);

            return $feedback;
        });

        return response()->json([
            'data' => [
                'submitted' => true,
                'rating' => $feedback->rating,
            ],
        ], 201);
    }

    private function resolveDay(string $token): OpenEventDay
    {
        $day = OpenEventDay::where('feedback_token', $token)->with('event')->first();

        abort_if($day === null, 404, 'Tautan feedback tidak valid.');

        return $day;
    }
}
