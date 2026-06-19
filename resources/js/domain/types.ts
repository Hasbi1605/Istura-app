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

export type Screen = "home" | "booking" | "feedback" | "open" | "admin";

export type AdminTab =
  | "dashboard"
  | "bookings"
  | "schedule"
  | "istura-open"
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
export type AdminAction = "accept" | "reject" | "reschedule" | "complete";

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
  participantCount?: number;
  bookingConflicts?: Array<{ code: string; groupSize: number; status: string }>;
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
  source?: "public" | "admin";
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
  documentationLink?: string;
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
  guideQuality: number | null;
  facilityComfort: number | null;
  recommend: number;
  visitedBefore: boolean | null;
  discoverySource: FeedbackDiscoverySource | null;
  discoverySourceOther: string;
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

export type BookingWizardStepCopy = {
  title: string;
  helper: string;
  miky: string;
};

export type BookingWizardContent = {
  steps: BookingWizardStepCopy[];
  preparation: {
    items: string[];
    scheduleLinkLabel: string;
    letterLinkLabel: string;
  };
  fields: {
    contactNameLabel: string;
    nikLabel: string;
    whatsappLabel: string;
    whatsappHelper: string;
    institutionLabel: string;
    groupSizeLabel: string;
  };
  schedule: {
    timeTitle: string;
    emptyDateLabel: string;
    emptySlotLabel: string;
    legendLabel: string;
    largeGroupTitle: string;
    largeGroupBody: string;
    largeGroupActionLabel: string;
  };
  upload: {
    readyLabel: string;
    emptyTitle: string;
    selectedTitle: string;
    helper: string;
    chooseLabel: string;
    replaceLabel: string;
  };
  agreementText: string;
  successMessage: string;
  actions: {
    backLabel: string;
    nextLabel: string;
    submitLabel: string;
    homeLabel: string;
  };
};

export type FeedbackWizardStepCopy = {
  title: string;
  bubbleTitle: string;
};

export type FeedbackDiscoverySource =
  | "social_media"
  | "friends_family"
  | "school_institution"
  | "web_search"
  | "previous_visit"
  | "other";

export type FeedbackDiscoverySourceOption = {
  value: FeedbackDiscoverySource;
  label: string;
};

export type FeedbackWizardContent = {
  intro: string;
  steps: {
    rating: FeedbackWizardStepCopy & {
      bubbleEmpty: string;
      bubbleLow: string;
      bubbleNeutral: string;
      bubbleHigh: string;
    };
    visit: FeedbackWizardStepCopy & {
      bubbleEmpty: string;
      bubbleDone: string;
    };
    details: FeedbackWizardStepCopy & {
      bubbleEmpty: string;
      bubbleHighlightsEmpty: string;
      bubbleDone: string;
    };
    comment: FeedbackWizardStepCopy & {
      bubbleEmpty: string;
      bubbleDone: string;
    };
  };
  fields: {
    ratingLabel: string;
    bookingEaseLabel: string;
    serviceLabel: string;
    guideQualityLabel: string;
    facilityComfortLabel: string;
    visitedBeforeLegend: string;
    visitedBeforeFirstLabel: string;
    visitedBeforeReturnLabel: string;
    discoverySourceLabel: string;
    discoverySourcePlaceholder: string;
    discoverySourceOtherLabel: string;
    discoverySourceOtherPlaceholder: string;
    recommendLegend: string;
    recommendLowLabel: string;
    recommendHighLabel: string;
    highlightsLabel: string;
    improvementsLabel: string;
    commentLabel: string;
    commentPlaceholder: string;
    publishConsent: string;
    ratingLabels: string[];
  };
  options: {
    discoverySources: FeedbackDiscoverySourceOption[];
    highlights: string[];
    improvements: string[];
  };
  gates: {
    loadingTitle: string;
    loadingMessage: string;
    invalidTitle: string;
    invalidMessage: string;
    alreadySubmittedTitle: string;
    alreadySubmittedMessage: string;
    unavailableTitle: string;
    unavailableMessage: string;
    restrictedLoadingTitle: string;
    restrictedTitle: string;
    restrictedLoadingMessage: string;
    restrictedMessage: string;
    busyLabel: string;
  };
  success: {
    eyebrow: string;
    title: string;
    message: string;
  };
  actions: {
    backLabel: string;
    nextLabel: string;
    submitLabel: string;
    homeLabel: string;
  };
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
  openBanner: {
    tickerText: string;
  };
  bookingWizard: BookingWizardContent;
  feedbackWizard: FeedbackWizardContent;
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

// ---- Istura Open (event registration module) ---------------------------

export type OpenEventDayPublic = {
  id: number;
  date: string;
  quota: number;
  used: number;
  remaining: number;
  isOpen: boolean;
};

// Public-facing active event summary (no WhatsApp links).
export type OpenEventPublic = {
  name: string;
  slug: string;
  startDate: string;
  endDate: string;
  registrationWindowOpen: boolean;
  maxAddons: number;
  agreementText: string | null;
  posterUrl: string | null;
  promoSubtitle: string | null;
  bannerText: string | null;
  days: OpenEventDayPublic[];
};

// Result returned after a successful registration / lookup (includes link).
export type OpenRegistrationResult = {
  code: string;
  status: string;
  dayDate: string | null;
  headcount: number;
  members: string[];
  whatsappGroupUrl: string | null;
};

export type OpenEventDayAdmin = {
  id: number;
  date: string;
  quota: number;
  quotaOverride: number | null;
  isOpen: boolean;
  opensAt: string | null;
  whatsappGroupUrl?: string | null;
  hasWhatsappGroupUrl: boolean;
};

// Active rombongan bookings that collide with a date being opened for Istura Open.
export type OpenDayBookingConflict = {
  code: string;
  time: string | null;
  groupSize: number;
  status: string;
  statusLabel: string;
};

export type OpenEventAdmin = {
  id: number;
  name: string;
  slug: string;
  startDate: string;
  endDate: string;
  perDayQuota: number;
  maxAddons: number;
  assignmentMode: string;
  releaseMode: string;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  agreementText: string | null;
  posterUrl: string | null;
  promoSubtitle: string | null;
  bannerText: string | null;
  isActive: boolean;
  archivedAt: string | null;
  isArchived: boolean;
  isPast: boolean;
  lifecycleStatus: "draft" | "active" | "past" | "archived";
  registrationsCount: number;
  days: OpenEventDayAdmin[];
};

export type OpenQuotaSummary = {
  dayId: number;
  date: string;
  quota: number;
  used: number;
  remaining: number;
  isOpen: boolean;
  opensAt: string | null;
};

export type OpenRegistrationAdmin = {
  code: string;
  contactName: string;
  nik?: string;
  nikMasked: string;
  whatsapp: string;
  city: string | null;
  members: string[];
  addonCount: number;
  headcount: number;
  status: string;
  dayId: number | null;
  dayDate?: string;
  registeredAt: string | null;
  cancelledAt: string | null;
};
