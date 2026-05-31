<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\RescheduleBookingRequest;
use App\Http\Requests\Admin\UpdateBookingSegmentsRequest;
use App\Http\Requests\Admin\UpdateBookingStatusRequest;
use App\Http\Resources\BookingResource;
use App\Models\Booking;
use App\Services\BookingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class BookingController extends Controller
{
    public function __construct(private readonly BookingService $bookings) {}

    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', Booking::class);

        $query = Booking::query()
            ->with('slots')
            ->when($request->string('status')->trim()->value(), fn ($q, $status) => $q->where('status', $status))
            ->when($request->string('search')->trim()->value(), function ($q, $term) {
                $q->where(function ($w) use ($term) {
                    $w->where('code', 'like', "%{$term}%")
                        ->orWhere('contact_name', 'like', "%{$term}%")
                        ->orWhere('institution', 'like', "%{$term}%");
                });
            })
            ->forRange($request->date('from')?->toDateString(), $request->date('to')?->toDateString())
            ->orderByDesc('submitted_at');

        return response()->json([
            'data' => BookingResource::collection($query->get())->resolve(),
        ]);
    }

    public function show(string $code): JsonResponse
    {
        $booking = Booking::with('slots')->where('code', $code)->firstOrFail();
        Gate::authorize('view', $booking);

        return response()->json(['data' => (new BookingResource($booking))->resolve()]);
    }

    public function accept(UpdateBookingStatusRequest $request, string $code): JsonResponse
    {
        $booking = Booking::with('slots')->where('code', $code)->firstOrFail();
        Gate::authorize('update', $booking);
        $updated = $this->bookings->accept($booking, $request->user(), $request->input('note'));

        return response()->json(['data' => (new BookingResource($updated))->resolve()]);
    }

    public function reject(UpdateBookingStatusRequest $request, string $code): JsonResponse
    {
        $booking = Booking::with('slots')->where('code', $code)->firstOrFail();
        Gate::authorize('update', $booking);
        $updated = $this->bookings->reject($booking, $request->user(), $request->input('note'));

        return response()->json(['data' => (new BookingResource($updated))->resolve()]);
    }

    public function reschedule(RescheduleBookingRequest $request, string $code): JsonResponse
    {
        $booking = Booking::with('slots')->where('code', $code)->firstOrFail();
        Gate::authorize('update', $booking);
        $payload = $request->validated();

        $updated = $this->bookings->reschedule(
            $booking,
            $request->user(),
            $payload['proposedDate'],
            $payload['proposedTime'],
            $payload['note'] ?? null,
        );

        return response()->json(['data' => (new BookingResource($updated))->resolve()]);
    }

    public function cancelReschedule(UpdateBookingStatusRequest $request, string $code): JsonResponse
    {
        $booking = Booking::with('slots')->where('code', $code)->firstOrFail();
        Gate::authorize('update', $booking);
        $updated = $this->bookings->cancelReschedule($booking, $request->user(), $request->input('note'));

        return response()->json(['data' => (new BookingResource($updated))->resolve()]);
    }

    public function complete(UpdateBookingStatusRequest $request, string $code): JsonResponse
    {
        $booking = Booking::with('slots')->where('code', $code)->firstOrFail();
        Gate::authorize('update', $booking);
        $updated = $this->bookings->complete($booking, $request->user());

        return response()->json(['data' => (new BookingResource($updated))->resolve()]);
    }

    public function segments(UpdateBookingSegmentsRequest $request, string $code): JsonResponse
    {
        $booking = Booking::with('slots')->where('code', $code)->firstOrFail();
        Gate::authorize('update', $booking);
        $updated = $this->bookings->overrideSegments(
            $booking,
            $request->user(),
            $request->validated('segments'),
            $request->input('note'),
        );

        return response()->json(['data' => (new BookingResource($updated))->resolve()]);
    }

    public function document(Request $request, string $code): StreamedResponse|BinaryFileResponse
    {
        $booking = Booking::where('code', $code)->firstOrFail();
        Gate::authorize('downloadDocument', $booking);
        abort_unless($booking->document_path, 404);
        abort_unless(Storage::disk('local')->exists($booking->document_path), 404);

        if ($request->string('disposition')->value() === 'inline') {
            return response()->file(
                Storage::disk('local')->path($booking->document_path),
                ['Content-Type' => Storage::disk('local')->mimeType($booking->document_path) ?? 'application/octet-stream'],
            );
        }

        return Storage::disk('local')->download(
            $booking->document_path,
            $booking->document_original_name,
        );
    }
}
