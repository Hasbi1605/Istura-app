import type { Dispatch, SetStateAction } from "react";
import type {
	AdminSession,
	AdminTab,
	Booking,
	CmsSyncState,
	DataLoadingState,
	Feedback,
  FaqItem,
  FooterContact,
  Screen,
  SiteContent,
  VisitDay,
  WaTemplate,
} from "../../domain/types";
import type { ApiHero, ApiLetter } from "../../api/cms";
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
  AdminLetterManager,
  AdminHeroManager,
  AdminLandingManager,
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
  onHeroChange,
  onLetterChange,
  siteContent,
  onSiteContentChange,
	bookingFocusCode,
	onBookingFocusCodeChange,
	loading,
	cmsSync,
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
  onHeroChange: Dispatch<SetStateAction<ApiHero>>;
  onLetterChange: Dispatch<SetStateAction<ApiLetter>>;
  siteContent: SiteContent;
  onSiteContentChange: Dispatch<SetStateAction<SiteContent>>;
	bookingFocusCode: string | null;
	onBookingFocusCodeChange: Dispatch<SetStateAction<string | null>>;
	loading: DataLoadingState;
	cmsSync: CmsSyncState;
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

  const canManageUsers = session.role === "Super Admin";
  const safeAdminTab: AdminTab = !canManageUsers && adminTab === "users" ? "dashboard" : adminTab;

  return (
    <AdminShell
      session={session}
      tab={safeAdminTab}
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
      {safeAdminTab === "dashboard" && (
		<AdminDashboard
			bookings={bookings}
			feedbacks={feedbacks}
			loading={loading.admin || loading.bookings || loading.feedbacks}
			onJumpTab={onAdminTabChange}
          adminName={session.name}
        />
      )}
      {safeAdminTab === "bookings" && (
		<AdminScreen
			schedules={schedules}
			bookings={bookings}
			loading={loading.bookings}
			onBookingsChange={onBookingsChange}
          onSchedulesChange={onSchedulesChange}
          focusCode={bookingFocusCode}
          onFocusCodeConsumed={() => onBookingFocusCodeChange(null)}
          adminName={session.name}
        />
      )}
      {safeAdminTab === "feedback" && (
		<AdminFeedbackList
			bookings={bookings}
			feedbacks={feedbacks}
			loading={loading.feedbacks}
			adminName={session.name}
        />
      )}
      {safeAdminTab === "schedule" && (
		<AdminScheduleManager
			schedules={schedules}
			bookings={bookings}
			loading={loading.schedule}
			onSchedulesChange={onSchedulesChange}
          onOpenBooking={(code) => {
            onBookingFocusCodeChange(code);
            onAdminTabChange("bookings");
          }}
        />
      )}
		{safeAdminTab === "cms-faq" && (
			<AdminFaqManager faqs={faqs} syncStatus={cmsSync.faqs} onChange={onFaqsChange} />
		)}
		{safeAdminTab === "cms-contacts" && (
			<AdminContactsManager contacts={contacts} syncStatus={cmsSync.contacts} onChange={onContactsChange} />
		)}
	  {safeAdminTab === "cms-letter" && <AdminLetterManager onChange={onLetterChange} />}
      {safeAdminTab === "cms-hero" && <AdminHeroManager onChange={onHeroChange} />}
		{safeAdminTab === "cms-landing" && (
			<AdminLandingManager content={siteContent} onChange={onSiteContentChange} />
		)}
		{safeAdminTab === "cms-wa" && (
			<AdminWaTemplates templates={waTemplates} syncStatus={cmsSync.waTemplates} onChange={onWaTemplatesChange} />
		)}
      {safeAdminTab === "users" && <AdminUsersList session={session} />}
      {safeAdminTab === "audit" && <AdminAuditLog />}
    </AdminShell>
  );
}
