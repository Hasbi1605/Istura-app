<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Http\Requests\Public\StoreBookingRequest;
use App\Http\Resources\BookingResource;
use App\Services\BookingService;
use Illuminate\Http\JsonResponse;

class BookingController extends Controller
{
    public function __construct(private readonly BookingService $bookings) {}

    public function store(StoreBookingRequest $request): JsonResponse
    {
        $booking = $this->bookings->createFromPublic(
            $request->validated(),
            $request->file('document'),
        );

        return response()->json([
            'data' => (new BookingResource($booking->loadMissing('slots')))->resolve(),
        ], 201);
    }
}
