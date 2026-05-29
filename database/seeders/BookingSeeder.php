<?php

namespace Database\Seeders;

use App\Models\Booking;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Crypt;

class BookingSeeder extends Seeder
{
    public function run(): void
    {
        $items = json_decode(file_get_contents(database_path('seeders/data/bookings.json')), true);

        foreach ($items as $b) {
            $nik = $b['nik'];

            Booking::updateOrCreate(
                ['code' => $b['code']],
                [
                    'contact_name' => $b['contactName'],
                    'nik_encrypted' => Crypt::encryptString($nik),
                    'nik_masked' => $b['nikMasked'],
                    'whatsapp' => $b['whatsapp'],
                    'institution' => $b['institution'],
                    'group_size' => $b['groupSize'],
                    'date' => $b['date'],
                    'date_label' => $b['dateLabel'],
                    'time' => $b['time'],
                    'status' => $b['status'],
                    'document_path' => null,
                    'document_original_name' => $b['documentName'],
                    'feedback_token' => $b['feedbackToken'],
                    'submitted_at' => $this->parseSubmittedAt($b['submittedAt']),
                    'completed_at' => isset($b['completedAt']) ? $this->parseSubmittedAt($b['completedAt']) : null,
                    'note' => $b['note'] ?? null,
                    'proposed_date' => $b['proposedDate'] ?? null,
                    'proposed_date_label' => $b['proposedDateLabel'] ?? null,
                    'proposed_time' => $b['proposedTime'] ?? null,
                    'proposed_at' => isset($b['proposedAt']) ? $this->parseSubmittedAt($b['proposedAt']) : null,
                ],
            );
        }
    }

    /**
     * Parse Indonesian date string like "23 Mei 2026, 14.12 WIB" into Carbon.
     */
    private function parseSubmittedAt(string $value): Carbon
    {
        $months = [
            'Januari' => '01', 'Februari' => '02', 'Maret' => '03', 'April' => '04',
            'Mei' => '05', 'Juni' => '06', 'Juli' => '07', 'Agustus' => '08',
            'September' => '09', 'Oktober' => '10', 'November' => '11', 'Desember' => '12',
        ];
        $clean = trim(preg_replace('/\s*WIB\s*$/u', '', $value));
        // "23 Mei 2026, 14.12"
        if (! preg_match('/^(\d{1,2})\s+(\p{L}+)\s+(\d{4}),\s*(\d{1,2})\.(\d{2})$/u', $clean, $m)) {
            return Carbon::parse($value);
        }
        $month = $months[$m[2]] ?? '01';
        $iso = sprintf('%s-%s-%02d %02d:%s:00', $m[3], $month, (int) $m[1], (int) $m[4], $m[5]);

        return Carbon::createFromFormat('Y-m-d H:i:s', $iso, 'Asia/Jakarta');
    }
}
