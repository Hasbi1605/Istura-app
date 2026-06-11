import type { Booking, Feedback, VisitDay, VisitStatus } from "../domain/types";
import type { ApiBooking } from "./bookings";
import type { ApiFeedback } from "./feedback";
import type { ApiVisitDay } from "./schedule";

// Adapter: ApiBooking dari Laravel → tipe Booking lokal. Mostly identity karena
// API resource sudah meniru shape lama, tapi optional fields perlu di-null
// menjadi undefined supaya komponen yang pakai `?.` tetap aman.
export function apiBookingToLocal(b: ApiBooking): Booking {
  return {
    code: b.code,
    contactName: b.contactName,
    nik: b.nik ?? b.nikMasked ?? "",
    nikMasked: b.nikMasked,
    whatsapp: b.whatsapp,
    institution: b.institution,
    groupSize: b.groupSize,
    kloterCount: b.kloterCount,
    segments: b.segments,
    date: b.date,
    dateLabel: b.dateLabel,
    reportDate: b.reportDate ?? undefined,
    time: b.time,
    status: b.status,
    documentName: b.documentName,
    hasDocument: b.hasDocument ?? false,
    submittedAt: b.submittedAt,
    leadTimeDays: b.leadTimeDays ?? undefined,
    isShortNotice: b.isShortNotice ?? false,
    note: b.note ?? undefined,
    documentationLink: b.documentationLink ?? undefined,
    feedbackToken: b.feedbackToken ?? "",
    completedAt: b.completedAt ?? undefined,
    rejectedAt: b.rejectedAt ?? undefined,
    expiredAt: b.expiredAt ?? undefined,
    proposedDate: b.proposedDate ?? undefined,
    proposedDateLabel: b.proposedDateLabel ?? undefined,
    proposedTime: b.proposedTime ?? undefined,
    proposedSegments: b.proposedSegments ?? undefined,
    proposedAt: b.proposedAt ?? undefined,
  };
}

export function apiVisitDayToLocal(day: ApiVisitDay): VisitDay {
  return {
    date: day.date,
    label: day.label,
    short: day.short,
    closureReason: day.closureReason ?? undefined,
    holiday: day.holiday ?? undefined,
    slots: day.slots.map((slot) => ({
      time: slot.time,
      status: slot.status as VisitStatus,
      custom: slot.custom,
      bookingCount: slot.bookingCount,
      overbooked: slot.overbooked,
      closureReason: slot.closureReason ?? undefined,
    })),
  };
}

export function apiFeedbackToLocal(f: ApiFeedback): Feedback {
  return {
    code: f.code,
    rating: f.rating,
    bookingEase: f.bookingEase,
    service: f.service,
    guideQuality: f.guideQuality,
    facilityComfort: f.facilityComfort,
    recommend: f.recommend,
    visitedBefore: f.visitedBefore,
    discoverySource: f.discoverySource,
    discoverySourceOther: f.discoverySourceOther ?? "",
    highlights: f.highlights ?? [],
    improvements: f.improvements ?? [],
    comment: f.comment ?? "",
    allowPublish: f.allowPublish,
    submittedAt: f.submittedAt ?? undefined,
  };
}
