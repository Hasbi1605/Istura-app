<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\BookingResource;
use App\Http\Resources\FeedbackResource;
use App\Models\Booking;
use App\Models\Feedback;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;

/**
 * Aggregates the data the dashboard widget needs in one round-trip; the React
 * dashboard previously computed these from in-memory arrays.
 */
class DashboardController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $now = Carbon::today('Asia/Jakarta');

        return response()->json([
            'kpis' => [
                'pending' => Booking::where('status', 'Pending')->count(),
                'todayBookings' => Booking::whereDate('date', $now)->count(),
                'weekBookings' => Booking::whereBetween('date', [$now->copy()->startOfWeek(Carbon::MONDAY), $now->copy()->endOfWeek(Carbon::SUNDAY)])->count(),
                'monthBookings' => Booking::whereYear('date', $now->year)->whereMonth('date', $now->month)->count(),
                'totalCompleted' => Booking::where('status', 'Completed')->count(),
                'feedbacks' => Feedback::count(),
                'avgRating' => round((float) Feedback::avg('rating'), 2),
            ],
            'todayBookings' => BookingResource::collection(
                Booking::with('slots')->whereDate('date', $now)->orderBy('time')->get()
            )->resolve(),
            'recentFeedbacks' => FeedbackResource::collection(
                Feedback::orderByDesc('submitted_at')->limit(5)->get()
            )->resolve(),
        ]);
    }
}
