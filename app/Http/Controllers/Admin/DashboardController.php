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
        $today = $now->toDateString();
        $weekStart = $now->copy()->startOfWeek(Carbon::MONDAY)->toDateString();
        $weekEnd = $now->copy()->endOfWeek(Carbon::SUNDAY)->toDateString();
        $monthStart = $now->copy()->startOfMonth()->toDateString();
        $monthEnd = $now->copy()->endOfMonth()->toDateString();
        $bookingKpis = Booking::query()
            ->selectRaw(
                'SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as pending, '
                .'SUM(CASE WHEN date = ? THEN 1 ELSE 0 END) as today_bookings, '
                .'SUM(CASE WHEN date BETWEEN ? AND ? THEN 1 ELSE 0 END) as week_bookings, '
                .'SUM(CASE WHEN date BETWEEN ? AND ? THEN 1 ELSE 0 END) as month_bookings, '
                .'SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as total_completed',
                ['Pending', $today, $weekStart, $weekEnd, $monthStart, $monthEnd, 'Completed'],
            )
            ->first();
        $feedbackKpis = Feedback::query()
            ->selectRaw('COUNT(*) as feedbacks, AVG(rating) as avg_rating')
            ->first();

        return response()->json([
            'kpis' => [
                'pending' => (int) ($bookingKpis->pending ?? 0),
                'todayBookings' => (int) ($bookingKpis->today_bookings ?? 0),
                'weekBookings' => (int) ($bookingKpis->week_bookings ?? 0),
                'monthBookings' => (int) ($bookingKpis->month_bookings ?? 0),
                'totalCompleted' => (int) ($bookingKpis->total_completed ?? 0),
                'feedbacks' => (int) ($feedbackKpis->feedbacks ?? 0),
                'avgRating' => round((float) ($feedbackKpis->avg_rating ?? 0), 2),
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
