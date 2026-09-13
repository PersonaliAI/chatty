import { Metadata } from "next";
import { BACKEND_URL } from "@/lib/backend-client";
import BookClient from "./BookClient";

interface PageProps {
  params: Promise<{ botId: string }>;
  searchParams: Promise<{
    session_id?: string;
    t?: string;
    sig?: string;
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
    tz?: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { botId } = await params;
  try {
    const res = await fetch(`${BACKEND_URL}/api/widget/theme?bot_id=${encodeURIComponent(botId)}`, {
      next: { revalidate: 60 },
    });
    if (res.ok) {
      const bot = await res.json();
      return {
        title: `Schedule an Appointment | ${bot.name || "Chatty"}`,
        description: bot.welcome_message || "Select a time slot to book your appointment.",
      };
    }
  } catch {
    // fallback
  }

  return {
    title: "Schedule an Appointment | Chatty",
    description: "Book an appointment or demo meeting.",
  };
}

export default async function BookingPage({ params, searchParams }: PageProps) {
  const { botId } = await params;
  const query = await searchParams;

  let botData = null;
  try {
    const res = await fetch(`${BACKEND_URL}/api/widget/theme?bot_id=${encodeURIComponent(botId)}`, {
      next: { revalidate: 60 },
    });
    if (res.ok) {
      botData = await res.json();
    }
  } catch {
    // Graceful fallback
  }

  return (
    <BookClient
      botId={botId}
      botData={botData}
      sessionId={query.session_id}
      sig={query.sig}
      t={query.t}
      initialName={query.name}
      initialEmail={query.email}
      initialPhone={query.phone}
      initialCompany={query.company}
      visitorTimezone={query.tz}
      backendUrl={BACKEND_URL}
    />
  );
}
