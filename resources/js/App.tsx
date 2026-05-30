import { useRef } from "react";
import { Navigation } from "./components/layout/Navigation";
import { HomeScreen } from "./components/home/HomeScreen";
import { BookingWizard } from "./components/booking/BookingWizard";
import { FeedbackScreen } from "./components/feedback/FeedbackScreen";
import { AdminApp } from "./components/admin/AdminApp";
import { useNavEntranceAnimation, useHomeHeroAnimation } from "./animations/useHomeAnimations";
import { useIsturaData } from "./hooks/useIsturaData";
import type { Screen } from "./domain/types";

function App() {
  const pageRef = useRef<HTMLElement>(null);
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
    adminSession,
    setAdminSession,
    adminTab,
    setAdminTab,
		bookingFocusCode,
		setBookingFocusCode,
		loading,
		cmsSync,
	} = data;

  useNavEntranceAnimation(pageRef);
  useHomeHeroAnimation(pageRef, screen);

  const goToScreen = (nextScreen: Screen) => {
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
      {screen === "admin" ? (
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
				onExitToPublic={setScreen}
			/>
      ) : (
        <>
          <Navigation screen={screen} content={siteContent.nav} onNavigate={goToScreen} />

          {screen === "home" && (
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
          )}
          {screen === "booking" && (
            <BookingWizard
              schedules={schedules}
              bookings={bookings}
					contacts={contacts}
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
          )}
          {screen === "feedback" && (
            <FeedbackScreen
              bookings={bookings}
              submittedCode={submittedCode}
              feedbacks={feedbacks}
					access={feedbackAccess}
					loading={loading.feedbacks}
					onFeedbackCreate={(feedback) => setFeedbacks((current) => [feedback, ...current])}
            />
          )}
        </>
      )}
    </main>
  );
}

export default App;
