<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Http\Requests\Public\PrecheckBookingIdentityRequest;
use App\Http\Requests\Public\StoreBookingRequest;
use App\Http\Resources\BookingResource;
use App\Services\BookingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;

class BookingController extends Controller
{
    public function __construct(private readonly BookingService $bookings) {}

    public function store(StoreBookingRequest $request): JsonResponse
    {
        $booking = $this->bookings->createFromPublic(
            $request->validated(),
            $request->file('document'),
            $request,
        );

        return response()->json([
            'data' => (new BookingResource($booking->loadMissing('slots')))->resolve(),
        ], 201);
    }

    /**
     * Early warning untuk wizard: cek apakah identitas sudah mencapai batas
     * booking aktif sebelum user mengisi seluruh form. Read-only, tidak menulis
     * data apa pun. Validasi final tetap dijalankan saat submit.
     */
    public function precheck(PrecheckBookingIdentityRequest $request): JsonResponse
    {
        $data = $request->validated();

        if ($this->bookings->identityActiveBookingExceeded($data['nik'], $data['whatsapp'])) {
            $message = 'Identitas atau nomor WhatsApp ini sudah mencapai batas booking aktif. Tunggu proses selesai atau hubungi admin.';

            throw ValidationException::withMessages([
                'nik' => [$message],
                'whatsapp' => [$message],
            ]);
        }

        return response()->json(['data' => ['allowed' => true]]);
    }
}
