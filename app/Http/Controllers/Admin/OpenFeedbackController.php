<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\OpenFeedbackResource;
use App\Models\OpenEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OpenFeedbackController extends Controller
{
    /**
     * All feedback submissions for an event (read-only; viewer + admin).
     * Optionally scoped to a single day. Modest volume, so not paginated —
     * the frontend filters/exports client-side like registrations.
     */
    public function index(Request $request, OpenEvent $event): JsonResponse
    {
        $query = $event->feedbacks()->with('day')->orderByDesc('id');

        if ($dayId = $request->integer('dayId')) {
            $query->where('open_event_day_id', $dayId);
        }

        $feedbacks = $query->get();

        return response()->json([
            'data' => OpenFeedbackResource::collection($feedbacks)->resolve(),
            'event' => [
                'name' => $event->name,
                'slug' => $event->slug,
            ],
        ]);
    }
}
