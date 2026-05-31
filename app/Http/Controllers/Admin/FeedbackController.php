<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\FeedbackResource;
use App\Models\Feedback;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Gate;

class FeedbackController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', Feedback::class);

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

        $paginator = $query->paginate($this->perPage($request));

        return response()->json([
            'data' => FeedbackResource::collection($paginator->getCollection())->resolve(),
            'meta' => $this->paginationMeta($paginator),
        ]);
    }

    public function show(string $code): JsonResponse
    {
        $feedback = Feedback::where('code', $code)->firstOrFail();
        Gate::authorize('view', $feedback);

        return response()->json(['data' => (new FeedbackResource($feedback))->resolve()]);
    }

    private function perPage(Request $request): int
    {
        return min(max($request->integer('perPage', 100), 1), 500);
    }

    private function paginationMeta(LengthAwarePaginator $paginator): array
    {
        return [
            'currentPage' => $paginator->currentPage(),
            'perPage' => $paginator->perPage(),
            'total' => $paginator->total(),
            'lastPage' => $paginator->lastPage(),
        ];
    }
}
