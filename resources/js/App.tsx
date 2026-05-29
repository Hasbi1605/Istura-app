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
    adminSession,
    setAdminSession,
    adminTab,
    setAdminTab,
    bookingFocusCode,
    setBookingFocusCode,
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
          bookingFocusCode={bookingFocusCode}
          onBookingFocusCodeChange={setBookingFocusCode}
          onExitToPublic={setScreen}
        />
      ) : (
        <>
          <Navigation screen={screen} onNavigate={goToScreen} />

          {screen === "home" && (
            <HomeScreen
              contacts={contacts}
              faqs={faqs}
              schedules={schedules}
              onNavigate={goToScreen}
            />
          )}
          {screen === "booking" && (
            <BookingWizard
              schedules={schedules}
              bookings={bookings}
              onScheduleLock={setSchedules}
              onBookingCreate={(booking) => {
                setBookings((current) => [booking, ...current]);
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
              onFeedbackCreate={(feedback) => setFeedbacks((current) => [feedback, ...current])}
            />
          )}
        </>
      )}
    </main>
  );
}

export default App;
