<?php

namespace App\Models;

use Carbon\Carbon;
use DateTimeInterface;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

class Booking extends Model
{
    public const STATUSES = ['Pending', 'Accepted', 'Rejected', 'Reschedule', 'Completed', 'Expired'];

    public const ACTIVE_STATUSES = ['Pending', 'Accepted', 'Reschedule'];

    protected $fillable = [
        'contact_name',
        'nik',
        'whatsapp',
        'institution',
        'group_size',
        'date',
        'date_label',
        'time',
    ];

    protected $casts = [
        'date' => 'date',
        'submitted_at' => 'datetime',
        'completed_at' => 'datetime',
        'rejected_at' => 'datetime',
        'expired_at' => 'datetime',
        'proposed_date' => 'date',
        'proposed_segments' => 'array',
        'proposed_at' => 'datetime',
        'group_size' => 'integer',
    ];

    protected static function booted(): void
    {
        static::saving(function (Booking $booking) {
            $booking->active_slot_key = $booking->isActiveForSchedule()
                ? $booking->slotKey($booking->date, $booking->time)
                : null;
        });
    }

    public function feedback(): HasOne
    {
        return $this->hasOne(Feedback::class);
    }

    public function slots(): HasMany
    {
        return $this->hasMany(BookingSlot::class)->orderBy('slot_order');
    }

    /**
     * Encrypt NIK on write, decrypt on read.
     */
    protected function nik(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->nik_encrypted ? Crypt::decryptString($this->nik_encrypted) : null,
            set: fn (?string $value) => [
                'nik_encrypted' => $value ? Crypt::encryptString($value) : null,
                'nik_masked' => $value ? substr($value, 0, 4).str_repeat('*', max(0, strlen($value) - 8)).substr($value, -4) : null,
                'nik_hash' => $value ? self::identityHash($value) : null,
            ],
        );
    }

    protected function whatsapp(): Attribute
    {
        return Attribute::make(
            set: fn (?string $value) => [
                'whatsapp' => $value,
                'whatsapp_normalized' => self::normalizeWhatsapp($value),
            ],
        );
    }

    public static function identityHash(string $value): string
    {
        return hash_hmac('sha256', $value, (string) config('app.key'));
    }

    public static function normalizeWhatsapp(?string $value): ?string
    {
        if (! is_string($value) || $value === '') {
            return null;
        }

        if (str_starts_with($value, '08')) {
            return '62'.substr($value, 1);
        }

        return $value;
    }

    public function scopeForRange($query, ?string $from, ?string $to)
    {
        if (! $from && ! $to) {
            return $query;
        }

        return $query->where(function ($outer) use ($from, $to) {
            $outer
                ->where(function ($q) use ($from, $to) {
                    $q->where('status', 'Rejected');
                    $this->applyReportDateBounds($q, 'COALESCE(rejected_at, submitted_at)', $from, $to);
                })
                ->orWhere(function ($q) use ($from, $to) {
                    $q->where('status', 'Reschedule');
                    $this->applyReportDateBounds($q, 'COALESCE(proposed_date, date)', $from, $to);
                })
                ->orWhere(function ($q) use ($from, $to) {
                    $q->where('status', 'Expired');
                    $this->applyReportDateBounds($q, 'COALESCE(expired_at, date)', $from, $to);
                })
                ->orWhere(function ($q) use ($from, $to) {
                    $q->whereNotIn('status', ['Rejected', 'Reschedule', 'Expired']);
                    $this->applyReportDateBounds($q, 'date', $from, $to);
                });
        });
    }

    private function applyReportDateBounds($query, string $expression, ?string $from, ?string $to): void
    {
        $query
            ->when($from, fn ($q) => $q->whereDate(DB::raw($expression), '>=', $from))
            ->when($to, fn ($q) => $q->whereDate(DB::raw($expression), '<=', $to));
    }

    public function isActiveForSchedule(): bool
    {
        return in_array($this->status, self::ACTIVE_STATUSES, true);
    }

    public function visitStartsAt(): ?Carbon
    {
        if (! $this->date || ! $this->time) {
            return null;
        }

        return Carbon::createFromFormat(
            'Y-m-d H.i',
            $this->date->copy()->timezone('Asia/Jakarta')->toDateString().' '.$this->time,
            'Asia/Jakarta',
        );
    }

    public function proposedVisitStartsAt(): ?Carbon
    {
        if (! $this->proposed_date || ! $this->proposed_time) {
            return null;
        }

        return Carbon::createFromFormat(
            'Y-m-d H.i',
            $this->proposed_date->copy()->timezone('Asia/Jakarta')->toDateString().' '.$this->proposed_time,
            'Asia/Jakarta',
        );
    }

    public function hasVisitStarted(?Carbon $now = null): bool
    {
        $visitStartsAt = $this->visitStartsAt();

        return $visitStartsAt !== null
            && $visitStartsAt->lte(($now ?? now('Asia/Jakarta'))->copy()->timezone('Asia/Jakarta'));
    }

    public function hasProposedVisitStarted(?Carbon $now = null): bool
    {
        $visitStartsAt = $this->proposedVisitStartsAt();

        return $visitStartsAt !== null
            && $visitStartsAt->lte(($now ?? now('Asia/Jakarta'))->copy()->timezone('Asia/Jakarta'));
    }

    private function slotKey(DateTimeInterface|string|null $date, ?string $time): ?string
    {
        if (! $date || ! $time) {
            return null;
        }

        $dateKey = $date instanceof DateTimeInterface ? $date->format('Y-m-d') : $date;

        return $dateKey.'|'.$time;
    }
}
