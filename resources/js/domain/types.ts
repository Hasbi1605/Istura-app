// Domain types — shared across the app. Pure (no React, no fetch).
// Diekstrak dari App.tsx pada refactor F6.5; bentuknya tidak diubah agar
// seluruh komponen yang sudah ada tetap kompatibel.

export type ContactIconKey = "instagram" | "youtube" | "whatsapp" | "email" | "phone";

export type FooterContact = {
  label: string;
  value: string;
  href: string;
  iconKey: ContactIconKey;
};

export type Screen = "home" | "booking" | "feedback" | "admin";

export type AdminTab =
  | "dashboard"
  | "bookings"
  | "schedule"
  | "feedback"
  | "cms-faq"
  | "cms-letter"
  | "cms-contacts"
  | "cms-hero"
  | "cms-wa"
  | "users"
  | "audit";

export type VisitStatus = "Available" | "Held" | "Booked" | "Closed" | "Reschedule Hold";
export type BookingStatus = "Pending" | "Accepted" | "Rejected" | "Reschedule" | "Completed";
export type AdminAction = "accept" | "reject" | "reschedule";

export type Slot = {
  time: string;
  status: VisitStatus;
  custom?: boolean;
};

export type VisitDay = {
  date: string;
  label: string;
  short: string;
  slots: Slot[];
};

export type AdminSession = {
  email: string;
  name: string;
  role: string;
  loggedAt: string;
};

export type Booking = {
  code: string;
  contactName: string;
  nik: string;
  nikMasked: string;
  whatsapp: string;
  institution: string;
  groupSize: number;
  date: string;
  dateLabel: string;
  time: string;
  status: BookingStatus;
  documentName: string;
  submittedAt: string;
  note?: string;
  feedbackToken: string;
  completedAt?: string;
  // Reschedule lifecycle: when admin proposes a new slot we keep the original
  // date/time as-is and stash the proposed alternative so the WhatsApp reply
  // from the visitor can be confirmed by the admin in a follow-up step.
  proposedDate?: string;
  proposedDateLabel?: string;
  proposedTime?: string;
  proposedAt?: string;
};

export type Feedback = {
  code: string;
  rating: number;
  bookingEase: number;
  service: number;
  recommend: number;
  highlights: string[];
  improvements: string[];
  comment: string;
  allowPublish: boolean;
  submittedAt?: string;
};

export type BookingForm = {
  contactName: string;
  nik: string;
  whatsapp: string;
  institution: string;
  groupSize: string;
  date: string;
  time: string;
  documentName: string;
  agreement: boolean;
};

export type PublicDateStatus = "available" | "processing" | "full" | "closed" | "outside";

export type FaqItem = {
  id: string;
  question: string;
  answer: string;
  link?: { label: string; href: string };
};

export type WaTemplate = {
  id: BookingStatus;
  label: string;
  description: string;
  template: string;
};

// Booking list helpers (admin booking page)
export type BookingStatusFilter = BookingStatus | null;
export type BookingSort = "smart" | "submitted-desc" | "submitted-asc" | "date-asc" | "date-desc";
export type BookingDateRange = "all" | "today" | "week" | "month" | "custom";
export type BookingViewMode = "split" | "table";
export type BookingDensity = "comfortable" | "compact";
