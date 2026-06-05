import { useEffect, useState } from "react";
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
import { logout as apiLogout, me as apiMe, twoFactorChallenge, twoFactorStatus } from "../../api/auth";
import type { AuthUser } from "../../api/auth";
import { destroyEcho } from "../../realtime/echo";
import { clearAdminSession, writeAdminSession } from "../../lib/legacyShims";
import { AdminShell, AdminLogin } from "./AdminShell";
import { TwoFactorChallenge } from "./TwoFactorChallenge";
import { TwoFactorSetup } from "./TwoFactorSetup";
import { ButtonSpinner } from "../ui/LoadingStates";
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
	  const [needs2fa, setNeeds2fa] = useState(false);
	  const [needsSetup, setNeedsSetup] = useState(false);
	  const [checking2fa, setChecking2fa] = useState(false);

  const sessionFromUser = (user: AuthUser): AdminSession => ({
    email: user.email,
    name: user.name,
    role: user.roleLabel,
    loggedAt: new Date().toISOString(),
  });

  const refreshAdminData = () => {
    onSessionChange((current) => current ? { ...current, loggedAt: new Date().toISOString() } : current);
  };

  useEffect(() => {
    if (!session) {
      setChecking2fa(false);
      setNeeds2fa(false);
      setNeedsSetup(false);
      return;
    }

    let cancelled = false;
    setChecking2fa(true);

    void (async () => {
      try {
        const { enabled } = await twoFactorStatus();
        if (cancelled) return;

        if (!enabled) {
          setNeedsSetup(true);
          setNeeds2fa(false);
          return;
        }

	        const { requires_2fa } = await twoFactorChallenge();
	        if (cancelled) return;

	        if (!requires_2fa && session.email === "") {
	          const user = await apiMe();
	          if (cancelled) return;

	          if (!user) {
	            doLogoutAndReset();
	            return;
	          }

	          const next = sessionFromUser(user);
	          writeAdminSession(next);
	          onSessionChange(next);
	        }

	        setNeeds2fa(requires_2fa);
	        setNeedsSetup(false);
      } catch {
        if (cancelled) return;
        setNeeds2fa(true);
      } finally {
        if (!cancelled) setChecking2fa(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session]);

  const doLogoutAndReset = () => {
    clearAdminSession();
    onSessionChange(null);
    setNeeds2fa(false);
    setNeedsSetup(false);
    setChecking2fa(false);
    destroyEcho();
    window.history.replaceState(null, "", "/admin");
    void apiLogout().catch(() => {});
  };

  if (!session) {
    return (
	      <AdminLogin
	        onAuthenticated={(next) => {
	          writeAdminSession(next);
	          onSessionChange(next);
	          onAdminTabChange("dashboard");
	          window.history.replaceState(null, "", "/admin");
	        }}
	        onTwoFactorRequired={() => {
	          onSessionChange({
	            email: "",
	            name: "Admin",
	            role: "Admin",
	            loggedAt: new Date().toISOString(),
	          });
	          setNeeds2fa(true);
	          setNeedsSetup(false);
	          setChecking2fa(false);
	          window.history.replaceState(null, "", "/admin");
	        }}
	        onCancel={() => {
	          onExitToPublic("home");
	          window.history.replaceState(null, "", "/");
	        }}
	      />
    );
  }

  if (checking2fa) {
    return (
      <div className="admin-login">
        <div className="admin-login-card" style={{ maxWidth: 440, textAlign: "center" }}>
          <ButtonSpinner label="Memeriksa keamanan akun..." />
        </div>
      </div>
    );
  }

  if (needsSetup) {
    return (
      <TwoFactorSetup
        onComplete={() => {
          setNeedsSetup(false);
          refreshAdminData();
        }}
        onCancel={doLogoutAndReset}
      />
    );
  }

	  if (needs2fa) {
	    return (
	      <TwoFactorChallenge
	        onVerified={() => {
	          void apiMe()
	            .then((user) => {
	              if (!user) {
	                doLogoutAndReset();
	                return;
	              }

	              const next = sessionFromUser(user);
	              writeAdminSession(next);
	              onSessionChange(next);
	              setNeeds2fa(false);
	              refreshAdminData();
	            })
	            .catch(doLogoutAndReset);
	        }}
	        onCancel={doLogoutAndReset}
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
