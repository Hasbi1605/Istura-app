<?php

namespace Database\Seeders;

use App\Models\AuditLog;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

class AuditLogSeeder extends Seeder
{
    public function run(): void
    {
        $items = json_decode(file_get_contents(database_path('seeders/data/audit_logs.json')), true);
        $admin = User::where('role', User::ROLE_SUPER_ADMIN)->first();

        foreach ($items as $entry) {
            AuditLog::create([
                'actor_id' => $admin?->id,
                'actor_name' => $entry['actor'],
                'action' => $entry['action'],
                'target_type' => null,
                'target_id' => null,
                'payload' => null,
                'created_at' => $this->parseAt($entry['at']),
            ]);
        }
    }

    private function parseAt(string $value): Carbon
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
