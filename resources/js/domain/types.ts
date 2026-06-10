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
  | "cms-landing"
  | "cms-wa"
  | "users"
  | "audit";

export type VisitStatus = "Available" | "Held" | "Booked" | "Closed" | "Reschedule Hold";
export type BookingStatus = "Pending" | "Accepted" | "Rejected" | "Reschedule" | "Completed" | "Expired";
export type AdminAction = "accept" | "reject" | "reschedule";

export type ClosureReason = {
  type: string;
  name: string;
  label: string;
  tentative?: boolean;
};

export type NationalHolidayInfo = ClosureReason & {
  source?: string;
  sourceUrl?: string;
};

export type Slot = {
  time: string;
  status: VisitStatus;
  custom?: boolean;
  bookingCount?: number;
  overbooked?: boolean;
  closureReason?: ClosureReason | null;
};

export type VisitDay = {
  date: string;
  label: string;
  short: string;
  closureReason?: ClosureReason | null;
  holiday?: NationalHolidayInfo | null;
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
  kloterCount?: number;
  segments?: BookingSegment[];
  date: string;
  dateLabel: string;
  reportDate?: string;
  time: string;
  status: BookingStatus;
  documentName: string;
  hasDocument?: boolean;
  submittedAt: string | null;
  leadTimeDays?: number | null;
  isShortNotice?: boolean;
  note?: string;
  feedbackToken: string;
  completedAt?: string;
  rejectedAt?: string;
  expiredAt?: string;
  // Reschedule lifecycle: when admin proposes a new slot we keep the original
  // date/time as-is and stash the proposed alternative so the WhatsApp reply
  // from the visitor can be confirmed by the admin in a follow-up step.
  proposedDate?: string;
  proposedDateLabel?: string;
  proposedTime?: string;
  proposedSegments?: BookingSegment[];
  proposedAt?: string;
};

export type BookingSegment = {
  order: number;
  date: string;
  dateLabel: string;
  time: string;
  groupSize: number;
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

export type LandingIconKey =
  | "clock"
  | "file-check"
  | "message-circle"
  | "calendar"
  | "pen"
  | "upload"
  | "map-pin"
  | "image";

export type LandingNavItem = {
  label: string;
  target: string;
};

export type LandingInfoCard = {
  iconKey: LandingIconKey;
  title: string;
  body: string;
  points: string[];
};

export type LandingStepCard = {
  iconKey: LandingIconKey;
  title: string;
  body: string;
};

export type LandingActivity = {
  title: string;
  body: string;
  image: string;
};

export type SiteContent = {
  nav: {
    logoSrc: string;
    logoAlt: string;
    brandText: string;
    ctaLabel: string;
    items: LandingNavItem[];
  };
  quickInfo: {
    title: string;
    description: string;
    cards: LandingInfoCard[];
  };
  schedule: {
    title: string;
    description: string;
  };
  video: {
    title: string;
    url: string;
  };
  bookingSteps: {
    title: string;
    story: string;
    cards: LandingStepCard[];
  };
  activities: {
    title: string;
    description: string;
    items: LandingActivity[];
  };
  rulesSection: {
    title: string;
    description: string;
    rulesKicker: string;
    rulesTitle: string;
    rulesList: string[];
    buttonLabel: string;
  };
  letterSection: {
    title: string;
    description: string;
    formatKicker: string;
    formatTitle: string;
    uploadNote: string;
    buttonLabel: string;
  };
  faq: {
    title: string;
    description: string;
  };
  cta: {
    title: string;
    body: string;
    buttonLabel: string;
    backgroundImage: string;
  };
  footer: {
    logoSrc: string;
    logoAlt: string;
    scheduleLabel: string;
    scheduleDays: string;
    scheduleHours: string;
    mapUrl: string;
    mapEmbedUrl: string;
    address: string;
    copyright: string;
  };
  floatingContact: {
    greeting: string;
    topics: FloatingContactTopic[];
  };
};

export type FloatingContactTopic = {
  label: string;
  message: string;
};

// Booking list helpers (admin booking page)
export type BookingStatusFilter = BookingStatus | null;
export type BookingSort = "smart" | "submitted-desc" | "submitted-asc" | "date-asc" | "date-desc";
export type BookingDateRange = "all" | "today" | "week" | "month" | "custom";
export type BookingViewMode = "split" | "table";
export type BookingDensity = "comfortable" | "compact";

export type DataLoadingState = {
  public: boolean;
  admin: boolean;
  schedule: boolean;
  bookings: boolean;
  feedbacks: boolean;
};

export type CmsSyncKey = "faqs" | "contacts" | "waTemplates";
export type CmsSyncStatus = "idle" | "saving" | "saved" | "error";
export type CmsSyncState = Record<CmsSyncKey, CmsSyncStatus>;
