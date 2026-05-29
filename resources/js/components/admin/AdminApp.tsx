import type { Dispatch, SetStateAction } from "react";
import type {
  AdminSession,
  AdminTab,
  Booking,
  Feedback,
  FaqItem,
  FooterContact,
  Screen,
  VisitDay,
  WaTemplate,
} from "../../domain/types";
import { logout as apiLogout } from "../../api/auth";
import { destroyEcho } from "../../realtime/echo";
import { clearAdminSession, writeAdminSession } from "../../lib/legacyShims";
import { AdminShell, AdminLogin } from "./AdminShell";
import { AdminDashboard } from "./AdminDashboard";
import { AdminScreen } from "./BookingScreen";
import { AdminFeedbackList } from "./AdminFeedbackList";
import { AdminScheduleManager } from "./ScheduleManager";
import {
  AdminFaqManager,
  AdminContactsManager,
  AdminWaTemplates,
  AdminLetterPreview,
  AdminHeroPreview,
} from "./AdminCmsManagers";
import { AdminUsersList, AdminAuditLog } from "./AdminSystemPages";

export function AdminApp({
  session,
  onSessionChange,
  adminTab,
  onAdminTabChange,
  schedules,
  onSchedulesChange,
  bookings,
  onBookingsChange,
  feedbacks,
  faqs,
  onFaqsChange,
  contacts,
  onContactsChange,
  waTemplates,
  onWaTemplatesChange,
  bookingFocusCode,
  onBookingFocusCodeChange,
  onExitToPublic,
}: {
  session: AdminSession | null;
  onSessionChange: Dispatch<SetStateAction<AdminSession | null>>;
  adminTab: AdminTab;
  onAdminTabChange: Dispatch<SetStateAction<AdminTab>>;
  schedules: VisitDay[];
  onSchedulesChange: Dispatch<SetStateAction<VisitDay[]>>;
  bookings: Booking[];
  onBookingsChange: Dispatch<SetStateAction<Booking[]>>;
  feedbacks: Feedback[];
  faqs: FaqItem[];
  onFaqsChange: Dispatch<SetStateAction<FaqItem[]>>;
  contacts: FooterContact[];
  onContactsChange: Dispatch<SetStateAction<FooterContact[]>>;
  waTemplates: WaTemplate[];
  onWaTemplatesChange: Dispatch<SetStateAction<WaTemplate[]>>;
  bookingFocusCode: string | null;
  onBookingFocusCodeChange: Dispatch<SetStateAction<string | null>>;
  onExitToPublic: (screen: Screen) => void;
}) {
  if (!session) {
    return (
      <AdminLogin
        onAuthenticated={(next) => {
          writeAdminSession(next);
          onSessionChange(next);
          onAdminTabChange("dashboard");
          window.history.replaceState(null, "", "/admin");
        }}
        onCancel={() => {
          onExitToPublic("home");
          window.history.replaceState(null, "", "/");
        }}
      />
    );
  }

  return (
    <AdminShell
      session={session}
      tab={adminTab}
      onTabChange={onAdminTabChange}
      onLogout={() => {
        clearAdminSession();
        onSessionChange(null);
        destroyEcho();
        window.history.replaceState(null, "", "/admin");
        void apiLogout().catch(() => {});
      }}
      onExitToPublic={() => {
        onExitToPublic("home");
        window.history.replaceState(null, "", "/");
      }}
    >
      {adminTab === "dashboard" && (
        <AdminDashboard
          bookings={bookings}
          feedbacks={feedbacks}
          onJumpTab={onAdminTabChange}
          adminName={session.name}
        />
      )}
      {adminTab === "bookings" && (
        <AdminScreen
          schedules={schedules}
          bookings={bookings}
          onBookingsChange={onBookingsChange}
          onSchedulesChange={onSchedulesChange}
          focusCode={bookingFocusCode}
          onFocusCodeConsumed={() => onBookingFocusCodeChange(null)}
          adminName={session.name}
        />
      )}
      {adminTab === "feedback" && (
        <AdminFeedbackList
          bookings={bookings}
          feedbacks={feedbacks}
          adminName={session.name}
        />
      )}
      {adminTab === "schedule" && (
        <AdminScheduleManager
          schedules={schedules}
          bookings={bookings}
          onSchedulesChange={onSchedulesChange}
          onOpenBooking={(code) => {
            onBookingFocusCodeChange(code);
            onAdminTabChange("bookings");
          }}
        />
      )}
      {adminTab === "cms-faq" && (
        <AdminFaqManager faqs={faqs} onChange={onFaqsChange} />
      )}
      {adminTab === "cms-contacts" && (
        <AdminContactsManager contacts={contacts} onChange={onContactsChange} />
      )}
      {adminTab === "cms-letter" && <AdminLetterPreview />}
      {adminTab === "cms-hero" && <AdminHeroPreview />}
      {adminTab === "cms-wa" && (
        <AdminWaTemplates templates={waTemplates} onChange={onWaTemplatesChange} />
      )}
      {adminTab === "users" && <AdminUsersList />}
      {adminTab === "audit" && <AdminAuditLog />}
    </AdminShell>
  );
}
