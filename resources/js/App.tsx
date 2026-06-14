import { lazy, Suspense, useRef, useState } from "react";
import { Navigation } from "./components/layout/Navigation";
import { FloatingContact } from "./components/layout/FloatingContact";
import { HomeScreen } from "./components/home/HomeScreen";
import { IsturaOpenPromo } from "./components/open/IsturaOpenPromo";
import { InlineSpinner } from "./components/ui/LoadingStates";
import { useIsturaData } from "./hooks/useIsturaData";
import type { Screen } from "./domain/types";

const HomeAnimationLayer = lazy(() =>
  import("./animations/HomeAnimationLayer").then((module) => ({ default: module.HomeAnimationLayer })),
);

const BookingWizard = lazy(() =>
  import("./components/booking/BookingWizard").then((module) => ({ default: module.BookingWizard })),
);
const FeedbackScreen = lazy(() =>
  import("./components/feedback/FeedbackScreen").then((module) => ({ default: module.FeedbackScreen })),
);
const AdminApp = lazy(() =>
  import("./components/admin/AdminApp").then((module) => ({ default: module.AdminApp })),
);
const IsturaOpenWizard = lazy(() =>
  import("./components/open/IsturaOpenWizard").then((module) => ({ default: module.IsturaOpenWizard })),
);

function App() {
  const pageRef = useRef<HTMLElement>(null);
  const [feedbackNavigationLocked, setFeedbackNavigationLocked] = useState(false);
  const data = useIsturaData();
  const {
    screen,
    setScreen,
    schedules,
    setSchedules,
    bookings,
    setBookings,
    feedbacks,
    setFeedbacks,
    submittedCode,
    setSubmittedCode,
    feedbackAccess,
    faqs,
    setFaqs,
    contacts,
    setContacts,
    waTemplates,
    setWaTemplates,
    hero,
    setHero,
    letter,
    setLetter,
    siteContent,
    setSiteContent,
    openEvent,
    refetchOpenEvent,
    reloadAdmin,
    adminRefreshing,
    realtimeStatus,
    adminRealtimeReady,
    adminSession,
    setAdminSession,
    adminTab,
    setAdminTab,
    bookingFocusCode,
    setBookingFocusCode,
    loading,
    cmsSync,
  } = data;

  const screenFallback = (
    <div className="screen-fallback" aria-busy="true">
      <InlineSpinner label="Memuat halaman" />
    </div>
  );

  const goToScreen = (nextScreen: Screen) => {
    if (feedbackNavigationLocked && screen === "feedback") return;
    setScreen(nextScreen);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Navigasi ke home lalu scroll mulus ke seksi tertentu (dipakai wizard).
  const goToHomeSection = (sectionId: string) => {
    goToScreen("home");
    window.setTimeout(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 320);
  };

  return (
    <main ref={pageRef} className="app-shell overflow-x-hidden w-full max-w-full">
      <Suspense fallback={null}>
        <HomeAnimationLayer pageRef={pageRef} screen={screen} />
      </Suspense>
      {screen === "admin" ? (
        <Suspense fallback={screenFallback}>
          <AdminApp
            session={adminSession}
            onSessionChange={setAdminSession}
            adminTab={adminTab}
            onAdminTabChange={setAdminTab}
            schedules={schedules}
            onSchedulesChange={setSchedules}
            bookings={bookings}
            onBookingsChange={setBookings}
            feedbacks={feedbacks}
            faqs={faqs}
            onFaqsChange={setFaqs}
            contacts={contacts}
            onContactsChange={setContacts}
            waTemplates={waTemplates}
            onWaTemplatesChange={setWaTemplates}
            onHeroChange={setHero}
            onLetterChange={setLetter}
            siteContent={siteContent}
            onSiteContentChange={setSiteContent}
            bookingFocusCode={bookingFocusCode}
            onBookingFocusCodeChange={setBookingFocusCode}
            loading={loading}
            cmsSync={cmsSync}
            onReload={reloadAdmin}
            refreshing={adminRefreshing}
            realtimeStatus={realtimeStatus}
            adminRealtimeReady={adminRealtimeReady}
            onExitToPublic={setScreen}
          />
        </Suspense>
      ) : (
        <>
          <Navigation
            screen={screen}
            content={siteContent.nav}
            onNavigate={goToScreen}
            navigationLocked={feedbackNavigationLocked && screen === "feedback"}
          />

          {screen === "home" && (
            <>
              {openEvent?.registrationWindowOpen && (
                <IsturaOpenPromo event={openEvent} siteContent={siteContent} onRegister={() => goToScreen("open")} />
              )}
              <HomeScreen
                contacts={contacts}
                faqs={faqs}
                schedules={schedules}
                hero={hero}
                letter={letter}
                siteContent={siteContent}
                loading={loading.public || loading.schedule}
                onNavigate={goToScreen}
              />
            </>
          )}
          {screen === "open" && (
            <Suspense fallback={screenFallback}>
              <IsturaOpenWizard
                event={openEvent}
                onNavigate={goToScreen}
                onQuotaChanged={refetchOpenEvent}
              />
            </Suspense>
          )}
          {screen === "booking" && (
            <Suspense fallback={screenFallback}>
              <BookingWizard
                schedules={schedules}
                bookings={bookings}
                contacts={contacts}
                content={siteContent.bookingWizard}
                onScheduleLock={setSchedules}
                scheduleLoading={loading.schedule}
                onBookingCreate={(booking) => {
                  setBookings((current) => {
                    const existingIndex = current.findIndex((item) => item.code === booking.code);
                    if (existingIndex < 0) return [booking, ...current];

                    const next = current.slice();
                    next[existingIndex] = booking;
                    return next;
                  });
                  setSubmittedCode(booking.code);
                }}
                onShowExampleLetter={() => goToHomeSection("contoh-surat")}
                onShowSchedule={() => goToHomeSection("panduan")}
                onNavigate={goToScreen}
              />
            </Suspense>
          )}
          {screen === "feedback" && (
            <Suspense fallback={screenFallback}>
              <FeedbackScreen
                bookings={bookings}
                submittedCode={submittedCode}
                feedbacks={feedbacks}
                content={siteContent.feedbackWizard}
                access={feedbackAccess}
                loading={loading.feedbacks}
                onFeedbackCreate={(feedback) => setFeedbacks((current) => [feedback, ...current])}
                onNavigationLockChange={setFeedbackNavigationLocked}
              />
            </Suspense>
          )}

          {screen !== "booking" && screen !== "open" && (
            <FloatingContact contacts={contacts} content={siteContent.floatingContact} />
          )}
        </>
      )}
    </main>
  );
}

export default App;
