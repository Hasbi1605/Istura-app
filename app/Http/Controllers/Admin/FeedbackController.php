<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\FeedbackResource;
use App\Models\Feedback;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FeedbackController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Feedback::query()
            ->when($request->date('from'), fn ($q, $from) => $q->whereDate('submitted_at', '>=', $from))
            ->when($request->date('to'), fn ($q, $to) => $q->whereDate('submitted_at', '<=', $to))
            ->when($request->string('scope')->trim()->value(), function ($q, $scope) {
                if ($scope === 'positive') {
                    $q->where('rating', '>=', 4);
                } elseif ($scope === 'attention') {
                    $q->where('rating', '<=', 3);
                }
            })
            ->orderByDesc('submitted_at');

        return response()->json([
            'data' => FeedbackResource::collection($query->get())->resolve(),
        ]);
    }

    public function show(string $code): JsonResponse
    {
        $feedback = Feedback::where('code', $code)->firstOrFail();

        return response()->json(['data' => (new FeedbackResource($feedback))->resolve()]);
    }
}
