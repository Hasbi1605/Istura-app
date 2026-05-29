<?php

namespace Database\Seeders;

use App\Models\Booking;
use App\Models\Feedback;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

class FeedbackSeeder extends Seeder
{
    public function run(): void
    {
        $items = json_decode(file_get_contents(database_path('seeders/data/feedbacks.json')), true);

        foreach ($items as $f) {
            $booking = Booking::where('code', $f['code'])->first();

            Feedback::updateOrCreate(
                ['code' => $f['code']],
                [
                    'booking_id' => $booking?->id,
                    'rating' => $f['rating'],
                    'booking_ease' => $f['bookingEase'],
                    'service' => $f['service'],
                    'recommend' => $f['recommend'],
                    'highlights' => $f['highlights'] ?? [],
                    'improvements' => $f['improvements'] ?? [],
                    'comment' => $f['comment'] ?? null,
                    'allow_publish' => $f['allowPublish'] ?? false,
                    'submitted_at' => isset($f['submittedAt']) ? $this->parseSubmittedAt($f['submittedAt']) : null,
                ],
            );
        }
    }

    private function parseSubmittedAt(string $value): Carbon
    {
        $months = [
            'Januari' => '01', 'Februari' => '02', 'Maret' => '03', 'April' => '04',
            'Mei' => '05', 'Juni' => '06', 'Juli' => '07', 'Agustus' => '08',
            'September' => '09', 'Oktober' => '10', 'November' => '11', 'Desember' => '12',
        ];
        $clean = trim(preg_replace('/\s*WIB\s*$/u', '', $value));
        if (! preg_match('/^(\d{1,2})\s+(\p{L}+)\s+(\d{4}),\s*(\d{1,2})\.(\d{2})$/u', $clean, $m)) {
            return Carbon::parse($value);
        }
        $month = $months[$m[2]] ?? '01';
        $iso = sprintf('%s-%s-%02d %02d:%s:00', $m[3], $month, (int) $m[1], (int) $m[4], $m[5]);

        return Carbon::createFromFormat('Y-m-d H:i:s', $iso, 'Asia/Jakarta');
    }
}
