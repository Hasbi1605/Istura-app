<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\RescheduleBookingRequest;
use App\Http\Requests\Admin\UpdateBookingStatusRequest;
use App\Http\Resources\BookingResource;
use App\Models\Booking;
use App\Services\BookingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class BookingController extends Controller
{
    public function __construct(private readonly BookingService $bookings) {}

    public function index(Request $request): JsonResponse
    {
        $query = Booking::query()
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
        $booking = Booking::where('code', $code)->firstOrFail();

        return response()->json(['data' => (new BookingResource($booking))->resolve()]);
    }

    public function accept(UpdateBookingStatusRequest $request, string $code): JsonResponse
    {
        $booking = Booking::where('code', $code)->firstOrFail();
        $updated = $this->bookings->accept($booking, $request->user(), $request->input('note'));

        return response()->json(['data' => (new BookingResource($updated))->resolve()]);
    }

    public function reject(UpdateBookingStatusRequest $request, string $code): JsonResponse
    {
        $booking = Booking::where('code', $code)->firstOrFail();
        $updated = $this->bookings->reject($booking, $request->user(), $request->input('note'));

        return response()->json(['data' => (new BookingResource($updated))->resolve()]);
    }

    public function reschedule(RescheduleBookingRequest $request, string $code): JsonResponse
    {
        $booking = Booking::where('code', $code)->firstOrFail();
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

    public function complete(UpdateBookingStatusRequest $request, string $code): JsonResponse
    {
        $booking = Booking::where('code', $code)->firstOrFail();
        $updated = $this->bookings->complete($booking, $request->user());

        return response()->json(['data' => (new BookingResource($updated))->resolve()]);
    }

    public function document(string $code): StreamedResponse
    {
        $booking = Booking::where('code', $code)->firstOrFail();
        abort_unless($booking->document_path, 404);

        return Storage::disk('local')->download(
            $booking->document_path,
            $booking->document_original_name,
        );
    }
}
