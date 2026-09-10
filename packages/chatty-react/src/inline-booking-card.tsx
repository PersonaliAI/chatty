"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  Check,
  CheckCircle2,
  Video,
  ExternalLink,
  Globe,
  ChevronDown,
  Search,
  X,
  User,
  Mail,
  Phone,
  Building,
  FileText,
  Loader2,
  CalendarPlus,
  AlertCircle,
  RefreshCw,
  KeyRound,
  ShieldCheck,
} from "lucide-react";

const DEFAULT_BACKEND_URL = "https://api.chatty.personaliai.com";

interface TimeSlot {
  start: string;
  end: string;
  time_label: string;
  visitor_local_label: string;
}

interface SlotsResponse {
  enabled: boolean;
  message?: string;
  bot_id: string;
  duration_minutes: number;
  visitor_timezone: string;
  owner_timezone: string;
  provider: string;
  available_dates: string[];
  slots_by_date: Record<string, TimeSlot[]>;
  lead_fields: string[];
  lead_required_fields: string[];
  booking_require_business_email: boolean;
  booking_block_disposable_emails: boolean;
  booking_email_verification: boolean;
}

export interface ConfirmedMeeting {
  id?: string;
  meeting_link: string;
  formatted_time: string;
  summary: string;
  start_time: string;
  end_time: string;
  attendee_name: string;
  attendee_email: string;
  assigned_to_email?: string;
}

export interface InlineBookingCardProps {
  botId: string;
  sessionId?: string;
  visitorTimezone?: string;
  primaryColor?: string;
  backendUrl?: string;
  onBookingSuccess?: (meeting: ConfirmedMeeting) => void;
}

interface TzOption {
  id: string;
  city: string;
  label: string;
  countryOrRegion: string;
}

const WORLD_TIMEZONES: TzOption[] = [
  { id: "Pacific/Honolulu", city: "Honolulu", label: "HST (GMT-10)", countryOrRegion: "United States, Hawaii" },
  { id: "America/Anchorage", city: "Anchorage", label: "AKDT/AKST (GMT-8)", countryOrRegion: "United States, Alaska" },
  { id: "America/Los_Angeles", city: "Los Angeles", label: "Pacific Time (PT, GMT-7)", countryOrRegion: "United States, SF, Seattle, California" },
  { id: "America/Vancouver", city: "Vancouver", label: "Pacific Time (PT, GMT-7)", countryOrRegion: "Canada, British Columbia" },
  { id: "America/Denver", city: "Denver", label: "Mountain Time (MT, GMT-6)", countryOrRegion: "United States, Colorado, Utah" },
  { id: "America/Phoenix", city: "Phoenix", label: "Mountain Standard (MST, GMT-7)", countryOrRegion: "United States, Arizona" },
  { id: "America/Chicago", city: "Chicago", label: "Central Time (CT, GMT-5)", countryOrRegion: "United States, Dallas, Houston, Texas" },
  { id: "America/Mexico_City", city: "Mexico City", label: "CST (GMT-6)", countryOrRegion: "Mexico" },
  { id: "America/New_York", city: "New York", label: "Eastern Time (ET, GMT-4)", countryOrRegion: "United States, Boston, Miami, DC" },
  { id: "America/Toronto", city: "Toronto", label: "Eastern Time (ET, GMT-4)", countryOrRegion: "Canada, Ontario, Montreal" },
  { id: "America/Sao_Paulo", city: "Sao Paulo", label: "BRT (GMT-3)", countryOrRegion: "Brazil, Rio" },
  { id: "America/Buenos_Aires", city: "Buenos Aires", label: "ART (GMT-3)", countryOrRegion: "Argentina" },
  { id: "Atlantic/Reykjavik", city: "Reykjavik", label: "GMT (GMT+0)", countryOrRegion: "Iceland" },
  { id: "UTC", city: "UTC", label: "Coordinated Universal Time", countryOrRegion: "Global" },
  { id: "Europe/London", city: "London", label: "BST / GMT (GMT+1)", countryOrRegion: "United Kingdom, England, Ireland, Dublin" },
  { id: "Europe/Paris", city: "Paris", label: "CEST / CET (GMT+2)", countryOrRegion: "France" },
  { id: "Europe/Berlin", city: "Berlin", label: "CEST / CET (GMT+2)", countryOrRegion: "Germany, Munich, Frankfurt" },
  { id: "Europe/Amsterdam", city: "Amsterdam", label: "CEST / CET (GMT+2)", countryOrRegion: "Netherlands" },
  { id: "Europe/Rome", city: "Rome", label: "CEST / CET (GMT+2)", countryOrRegion: "Italy, Milan" },
  { id: "Europe/Madrid", city: "Madrid", label: "CEST / CET (GMT+2)", countryOrRegion: "Spain, Barcelona" },
  { id: "Europe/Zurich", city: "Zurich", label: "CEST / CET (GMT+2)", countryOrRegion: "Switzerland, Geneva" },
  { id: "Europe/Athens", city: "Athens", label: "EEST (GMT+3)", countryOrRegion: "Greece" },
  { id: "Europe/Istanbul", city: "Istanbul", label: "TRT (GMT+3)", countryOrRegion: "Turkey" },
  { id: "Africa/Cairo", city: "Cairo", label: "EEST (GMT+3)", countryOrRegion: "Egypt" },
  { id: "Africa/Johannesburg", city: "Johannesburg", label: "SAST (GMT+2)", countryOrRegion: "South Africa, Cape Town" },
  { id: "Africa/Lagos", city: "Lagos", label: "WAT (GMT+1)", countryOrRegion: "Nigeria" },
  { id: "Asia/Dubai", city: "Dubai", label: "GST (GMT+4)", countryOrRegion: "United Arab Emirates, UAE, Abu Dhabi" },
  { id: "Asia/Riyadh", city: "Riyadh", label: "AST (GMT+3)", countryOrRegion: "Saudi Arabia" },
  { id: "Asia/Karachi", city: "Karachi", label: "PKT (GMT+5)", countryOrRegion: "Pakistan, Islamabad, Lahore" },
  { id: "Asia/Kolkata", city: "Mumbai / New Delhi", label: "IST (GMT+5:30)", countryOrRegion: "India, Bengaluru, Bangalore, Hyderabad" },
  { id: "Asia/Colombo", city: "Colombo", label: "SLST (GMT+5:30)", countryOrRegion: "Sri Lanka" },
  { id: "Asia/Dhaka", city: "Dhaka", label: "BST (GMT+6)", countryOrRegion: "Bangladesh" },
  { id: "Asia/Bangkok", city: "Bangkok", label: "ICT (GMT+7)", countryOrRegion: "Thailand, Vietnam, Hanoi, Jakarta" },
  { id: "Asia/Singapore", city: "Singapore", label: "SGT (GMT+8)", countryOrRegion: "Singapore, Malaysia, Kuala Lumpur" },
  { id: "Asia/Hong_Kong", city: "Hong Kong", label: "HKT (GMT+8)", countryOrRegion: "Hong Kong" },
  { id: "Asia/Shanghai", city: "Shanghai / Beijing", label: "CST (GMT+8)", countryOrRegion: "China, Shenzhen, Guangzhou" },
  { id: "Asia/Taipei", city: "Taipei", label: "CST (GMT+8)", countryOrRegion: "Taiwan" },
  { id: "Asia/Seoul", city: "Seoul", label: "KST (GMT+9)", countryOrRegion: "South Korea" },
  { id: "Asia/Tokyo", city: "Tokyo", label: "JST (GMT+9)", countryOrRegion: "Japan, Osaka" },
  { id: "Australia/Perth", city: "Perth", label: "AWST (GMT+8)", countryOrRegion: "Australia, Western Australia" },
  { id: "Australia/Adelaide", city: "Adelaide", label: "ACST (GMT+9:30)", countryOrRegion: "Australia, South Australia" },
  { id: "Australia/Sydney", city: "Sydney", label: "AEST (GMT+10)", countryOrRegion: "Australia, Melbourne, Brisbane, Canberra" },
  { id: "Pacific/Auckland", city: "Auckland", label: "NZST (GMT+12)", countryOrRegion: "New Zealand, Wellington" },
];

function formatTimezoneCity(tzStr: string): string {
  if (!tzStr) return "Timezone";
  if (tzStr === "UTC") return "UTC";
  const parts = tzStr.split("/");
  const cityPart = parts[parts.length - 1];
  return cityPart.replace(/_/g, " ");
}

function getTimeInTimezone(tzStr: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tzStr,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date());
  } catch {
    return "";
  }
}

export function InlineBookingCard({
  botId,
  sessionId,
  visitorTimezone,
  primaryColor = "#f97316",
  backendUrl = DEFAULT_BACKEND_URL,
  onBookingSuccess,
}: InlineBookingCardProps) {
  const [loading, setLoading] = useState(true);
  const [slotsData, setSlotsData] = useState<SlotsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Timezone selection
  const detectedTz = useMemo(() => {
    if (visitorTimezone && visitorTimezone !== "UTC") return visitorTimezone;
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      return "UTC";
    }
  }, [visitorTimezone]);

  const [activeTimezone, setActiveTimezone] = useState(detectedTz);
  const [isTzOpen, setIsTzOpen] = useState(false);
  const [tzQuery, setTzQuery] = useState("");
  const tzDropdownRef = useRef<HTMLDivElement>(null);

  // Date strip scrolling
  const dateScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkDateScroll = () => {
    if (dateScrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = dateScrollRef.current;
      setCanScrollLeft(scrollLeft > 4);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4);
    }
  };

  const scrollDates = (direction: "left" | "right") => {
    if (dateScrollRef.current) {
      const amount = 160;
      dateScrollRef.current.scrollBy({
        left: direction === "left" ? -amount : amount,
        behavior: "smooth",
      });
    }
  };

  useEffect(() => {
    if (!isTzOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (tzDropdownRef.current && !tzDropdownRef.current.contains(e.target as Node)) {
        setIsTzOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsTzOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isTzOpen]);

  const filteredTimezones = useMemo(() => {
    let list = WORLD_TIMEZONES;
    if (activeTimezone && !list.some((t) => t.id === activeTimezone)) {
      list = [
        {
          id: activeTimezone,
          city: formatTimezoneCity(activeTimezone),
          label: activeTimezone,
          countryOrRegion: "Current",
        },
        ...list,
      ];
    }
    if (!tzQuery.trim()) return list;
    const q = tzQuery.toLowerCase().trim();
    return list.filter(
      (t) =>
        t.city.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        t.label.toLowerCase().includes(q) ||
        t.countryOrRegion.toLowerCase().includes(q)
    );
  }, [tzQuery, activeTimezone]);

  // Wizard state: 1: Slot Picker, 2: Lead Form / OTP, 3: Confirmed Card
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  // Form inputs
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [notes, setNotes] = useState("");

  // Email OTP verification state
  const [otpSent, setOtpSent] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [otpCooldown, setOtpCooldown] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmedMeeting, setConfirmedMeeting] = useState<ConfirmedMeeting | null>(null);

  // OTP cooldown ticker
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = setInterval(() => {
      setOtpCooldown((prev) => Math.max(prev - 1, 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCooldown]);

  // Fetch slots
  const fetchSlots = async (tz: string) => {
    try {
      setLoading(true);
      setError(null);
      const url = `${backendUrl}/api/widget/booking/slots?bot_id=${encodeURIComponent(botId)}&visitor_timezone=${encodeURIComponent(tz)}&days=14`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to load slots: HTTP ${res.status}`);
      }
      const data: SlotsResponse = await res.json();
      setSlotsData(data);
      if (data.available_dates && data.available_dates.length > 0) {
        setSelectedDate(data.available_dates[0]);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load scheduling calendar");
    } finally {
      setLoading(false);
      setTimeout(checkDateScroll, 100);
    }
  };

  useEffect(() => {
    if (botId) {
      fetchSlots(activeTimezone);
    }
  }, [botId, activeTimezone]);

  // Format date helper
  const formatDateLabel = (dateStr: string) => {
    try {
      const parts = dateStr.split("-");
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      const today = new Date();
      const isToday = d.toDateString() === today.toDateString();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const isTomorrow = d.toDateString() === tomorrow.toDateString();

      const dayName = isToday ? "Today" : isTomorrow ? "Tomorrow" : d.toLocaleDateString("en-US", { weekday: "short" });
      const monthDay = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return { dayName, monthDay, isToday };
    } catch {
      return { dayName: dateStr, monthDay: "", isToday: false };
    }
  };

  // Resend OTP handler
  const handleResendOtp = async () => {
    if (otpCooldown > 0 || !selectedSlot) return;
    setSubmitError(null);
    setVerificationCode("");
    await executeBookingSubmission("");
    setOtpCooldown(45);
  };

  // Core booking submission call
  const executeBookingSubmission = async (codeToSubmit?: string) => {
    if (!selectedSlot) return;

    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setSubmitError("Please enter your full name.");
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setSubmitError("Please enter a valid email address.");
      return;
    }

    if (slotsData?.booking_require_business_email) {
      const consumerDomains = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com"];
      const domain = trimmedEmail.split("@")[1];
      if (consumerDomains.includes(domain)) {
        setSubmitError("Please use a corporate or business work email.");
        return;
      }
    }

    // Check required lead fields
    const reqFields = slotsData?.lead_required_fields || ["name", "email"];
    if (reqFields.includes("phone") && !phone.trim()) {
      setSubmitError("Phone number is required.");
      return;
    }
    if (reqFields.includes("company") && !company.trim()) {
      setSubmitError("Company name is required.");
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError(null);

      const payload = {
        bot_id: botId,
        session_id: sessionId || null,
        start_time: selectedSlot.start,
        end_time: selectedSlot.end,
        visitor_timezone: activeTimezone,
        name: trimmedName,
        email: trimmedEmail,
        phone: phone.trim() || undefined,
        company: company.trim() || undefined,
        notes: notes.trim() || undefined,
        verification_code: (codeToSubmit ?? verificationCode).trim() || undefined,
      };

      const res = await fetch(`${backendUrl}/api/widget/booking/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || data.success === false) {
        // OTP required: transition smoothly to verification step
        if (data.otp_sent) {
          setOtpSent(true);
          setOtpCooldown(45);
          setSubmitError(data.error || "A 6-digit verification code was sent to your email.");
          return;
        }
        throw new Error(data.error || "Booking request failed");
      }

      const confirmed: ConfirmedMeeting = {
        id: data.meeting_id,
        meeting_link: data.meeting_link,
        formatted_time: data.formatted_time || selectedSlot.visitor_local_label,
        summary: data.summary || `Demo Meeting with ${trimmedName}`,
        start_time: data.start_time,
        end_time: data.end_time,
        attendee_name: data.attendee_name || trimmedName,
        attendee_email: data.attendee_email || trimmedEmail,
        assigned_to_email: data.assigned_to_email,
      };

      setConfirmedMeeting(confirmed);
      setStep(3);
      if (onBookingSuccess) {
        onBookingSuccess(confirmed);
      }
    } catch (err: any) {
      setSubmitError(err?.message || "Failed to confirm meeting. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeBookingSubmission();
  };

  // Google Calendar web URL
  const getGoogleCalendarUrl = (m: ConfirmedMeeting) => {
    const startIso = m.start_time.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const endIso = m.end_time.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(m.summary)}&dates=${startIso}/${endIso}&details=${encodeURIComponent(`Meeting link: ${m.meeting_link}`)}&location=${encodeURIComponent(m.meeting_link)}`;
  };

  // Download .ics file
  const downloadIcs = (m: ConfirmedMeeting) => {
    const formatIcs = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Chatty//Self-Hosted Meeting Scheduler//EN",
      "BEGIN:VEVENT",
      `SUMMARY:${m.summary}`,
      `DESCRIPTION:Join video call: ${m.meeting_link}`,
      `LOCATION:${m.meeting_link}`,
      `DTSTART:${formatIcs(m.start_time)}`,
      `DTEND:${formatIcs(m.end_time)}`,
      "STATUS:CONFIRMED",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "demo-meeting.ics";
    link.click();
    URL.revokeObjectURL(url);
  };

  // Loading state
  if (loading) {
    return (
      <div className="w-full my-2 p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-sm flex flex-col items-center justify-center gap-2 text-neutral-500 min-h-[140px]">
        <Loader2 className="size-5 animate-spin text-neutral-400" />
        <span className="text-xs font-medium">Checking available slots...</span>
      </div>
    );
  }

  // Scheduling disabled on bot: hide widget completely
  if (slotsData && !slotsData.enabled) {
    return null;
  }

  // Error state
  if (error || !slotsData) {
    return (
      <div className="w-full my-2 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-sm text-xs">
        <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
          <AlertCircle className="size-4 text-amber-500 shrink-0" />
          <span>{error || "Scheduling is temporarily unavailable."}</span>
        </div>
      </div>
    );
  }

  const availableDates = slotsData.available_dates || [];
  const currentSlots = (selectedDate && slotsData.slots_by_date[selectedDate]) || [];

  // Lead fields configuration
  const showPhone = !slotsData.lead_fields || slotsData.lead_fields.includes("phone");
  const showCompany = !slotsData.lead_fields || slotsData.lead_fields.includes("company");
  const isPhoneRequired = !!slotsData.lead_required_fields?.includes("phone");
  const isCompanyRequired = !!slotsData.lead_required_fields?.includes("company");

  return (
    <div className="w-full my-2.5 rounded-2xl border border-neutral-200/80 dark:border-neutral-700/80 bg-white dark:bg-neutral-900 shadow-sm overflow-hidden text-neutral-800 dark:text-neutral-200 font-sans transition-all">
      {/* Top Header */}
      <div className="px-3.5 py-2.5 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/40 flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-2 font-medium text-neutral-700 dark:text-neutral-300">
          <span className="flex items-center gap-1">
            <Clock className="size-3 text-neutral-400" />
            {slotsData.duration_minutes}m
          </span>
          <span className="text-neutral-300 dark:text-neutral-700">|</span>
          <span className="flex items-center gap-1">
            <Video className="size-3 text-neutral-400" />
            {slotsData.provider === "teams" ? "Teams" : "Google Meet"}
          </span>
        </div>

        {/* Modern Cal.com-style Timezone Selector */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setIsTzOpen(!isTzOpen);
              setTzQuery("");
            }}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white bg-neutral-100 hover:bg-neutral-200/80 dark:bg-neutral-800/80 dark:hover:bg-neutral-700/80 transition-all cursor-pointer border border-neutral-200/60 dark:border-neutral-700/60 shadow-2xs group"
            title="Click to change timezone"
          >
            <Globe className="size-3 text-neutral-500 group-hover:text-neutral-700 dark:group-hover:text-neutral-200 shrink-0" />
            <span className="truncate max-w-[130px] sm:max-w-[175px] font-medium">
              {formatTimezoneCity(activeTimezone)}
            </span>
            <ChevronDown className={`size-2.5 text-neutral-400 transition-transform duration-200 ${isTzOpen ? "rotate-180" : ""}`} />
          </button>

          {isTzOpen && (
            <div
              ref={tzDropdownRef}
              className="absolute right-0 top-full mt-1.5 w-64 max-w-[calc(100vw-40px)] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col"
            >
              {/* Popover Search Bar */}
              <div className="p-2 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-800/50">
                <div className="relative">
                  <Search className="size-3 text-neutral-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    autoFocus
                    placeholder="Search city or timezone..."
                    value={tzQuery}
                    onChange={(e) => setTzQuery(e.target.value)}
                    className="w-full pl-7 pr-6 py-1 text-[11px] bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md focus:outline-none focus:ring-1 focus:ring-neutral-400 text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400"
                  />
                  {tzQuery && (
                    <button
                      type="button"
                      onClick={() => setTzQuery("")}
                      className="absolute right-1.5 top-1.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-0.5"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Timezone List with modern scrollbar */}
              <div className="max-h-56 overflow-y-auto p-1 divide-y divide-neutral-100 dark:divide-neutral-800/50 chatty-custom-scrollbar">
                {filteredTimezones.length === 0 ? (
                  <div className="py-5 text-center text-[11px] text-neutral-400">
                    No matching timezone found
                  </div>
                ) : (
                  filteredTimezones.map((tz) => {
                    const isSelected = tz.id === activeTimezone;
                    const currentTime = getTimeInTimezone(tz.id);
                    return (
                      <button
                        key={tz.id}
                        type="button"
                        onClick={() => {
                          setActiveTimezone(tz.id);
                          setIsTzOpen(false);
                          setTzQuery("");
                          setSelectedSlot(null);
                        }}
                        className={`w-full px-2 py-1.5 flex items-center justify-between text-left rounded-md transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-neutral-100 dark:bg-neutral-800 font-medium text-neutral-900 dark:text-neutral-100"
                            : "hover:bg-neutral-50 dark:hover:bg-neutral-800/50 text-neutral-700 dark:text-neutral-300"
                        }`}
                      >
                        <div className="min-w-0 pr-1.5">
                          <div className="flex items-center gap-1">
                            <span className="text-xs truncate">{tz.city}</span>
                            {isSelected && (
                              <Check className="size-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            )}
                          </div>
                          <div className="text-[9px] text-neutral-400 truncate">
                            {tz.label}
                          </div>
                        </div>
                        {currentTime && (
                          <div className="text-[10px] tabular-nums text-neutral-500 dark:text-neutral-400 shrink-0 font-medium">
                            {currentTime}
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* VIEW 1: Slot Selector */}
      {step === 1 && (
        <div className="p-3.5 space-y-3">
          <div className="text-xs font-semibold text-neutral-800 dark:text-neutral-100">
            Select a Date & Time
          </div>

          {availableDates.length === 0 ? (
            <div className="py-6 text-center text-xs text-neutral-400">
              No open slots found in the next 14 days.
            </div>
          ) : (
            <>
              {/* Horizontal Date Picker Strip with modern scrollbar & navigation */}
              <div className="relative group/strip">
                {canScrollLeft && (
                  <button
                    type="button"
                    onClick={() => scrollDates("left")}
                    className="absolute -left-1.5 top-1/2 -translate-y-1/2 z-10 size-6 rounded-full bg-white/95 dark:bg-neutral-800/95 border border-neutral-200 dark:border-neutral-700 shadow-sm flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white cursor-pointer transition-transform active:scale-95"
                    title="Previous dates"
                  >
                    <ChevronLeft className="size-3.5" />
                  </button>
                )}

                <div
                  ref={dateScrollRef}
                  onScroll={checkDateScroll}
                  className="flex gap-1.5 overflow-x-auto pb-2 px-0.5 chatty-custom-scrollbar scroll-smooth"
                >
                  {availableDates.map((dStr) => {
                    const { dayName, monthDay } = formatDateLabel(dStr);
                    const isSelected = selectedDate === dStr;
                    const count = slotsData.slots_by_date[dStr]?.length || 0;

                    return (
                      <button
                        key={dStr}
                        type="button"
                        onClick={() => setSelectedDate(dStr)}
                        className={`shrink-0 flex flex-col items-center justify-center px-2.5 py-1.5 rounded-xl border text-center transition-all cursor-pointer ${
                          isSelected
                            ? "border-transparent text-white font-medium shadow-sm"
                            : "border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
                        }`}
                        style={{
                          backgroundColor: isSelected ? primaryColor : undefined,
                        }}
                      >
                        <span className={`text-[10px] uppercase tracking-wider ${isSelected ? "opacity-90" : "text-neutral-400 dark:text-neutral-500"}`}>
                          {dayName}
                        </span>
                        <span className="text-xs font-semibold leading-snug">
                          {monthDay}
                        </span>
                        <span className={`text-[9px] mt-0.5 ${isSelected ? "text-white/80" : "text-neutral-400 dark:text-neutral-500"}`}>
                          {count} {count === 1 ? "slot" : "slots"}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {canScrollRight && (
                  <button
                    type="button"
                    onClick={() => scrollDates("right")}
                    className="absolute -right-1.5 top-1/2 -translate-y-1/2 z-10 size-6 rounded-full bg-white/95 dark:bg-neutral-800/95 border border-neutral-200 dark:border-neutral-700 shadow-sm flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white cursor-pointer transition-transform active:scale-95"
                    title="Next dates"
                  >
                    <ChevronRight className="size-3.5" />
                  </button>
                )}
              </div>

              {/* Time Slots Grid with responsive columns & modern scrollbar */}
              <div className="pt-1">
                <div className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-2">
                  Available Slots ({activeTimezone})
                </div>
                {currentSlots.length === 0 ? (
                  <div className="py-4 text-center text-xs text-neutral-400">
                    No available times on this date.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 min-[360px]:grid-cols-3 gap-1.5 max-h-[170px] overflow-y-auto pr-1 chatty-custom-scrollbar">
                    {currentSlots.map((slot, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setSelectedSlot(slot);
                          setSubmitError(null);
                          setOtpSent(false);
                          setVerificationCode("");
                          setStep(2);
                        }}
                        className="px-2 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-500 bg-neutral-50/50 dark:bg-neutral-800/60 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-medium text-neutral-800 dark:text-neutral-200 transition-all text-center cursor-pointer active:scale-95"
                      >
                        {slot.time_label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* VIEW 2: Attendee Details OR Email OTP Verification */}
      {step === 2 && selectedSlot && (
        <div className="p-3.5 space-y-3">
          {/* Selected Slot Banner (no truncation, natural wrap) */}
          <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <Calendar className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 leading-snug break-words">
                  {selectedSlot.visitor_local_label}
                </div>
                <div className="text-[10px] text-neutral-500 dark:text-neutral-400">
                  {slotsData.duration_minutes} min video demo
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setSubmitError(null);
                setOtpSent(false);
                setStep(1);
              }}
              className="text-[11px] font-medium text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 underline cursor-pointer shrink-0 ml-2"
            >
              Change
            </button>
          </div>

          {submitError && (
            <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-[11px] flex items-start gap-2">
              <AlertCircle className="size-3.5 mt-0.5 shrink-0" />
              <span className="break-words">{submitError}</span>
            </div>
          )}

          {/* Subview A: Dedicated Email OTP Code Verification */}
          {otpSent ? (
            <form onSubmit={handleConfirmBooking} className="space-y-3 py-1">
              <div className="text-center space-y-1">
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                  <ShieldCheck className="size-3" />
                  Email Verification
                </div>
                <div className="text-xs text-neutral-600 dark:text-neutral-300">
                  Enter the 6-digit passcode sent to:
                </div>
                <div className="text-xs font-bold text-neutral-900 dark:text-white break-all">
                  {email}
                </div>
              </div>

              <div>
                <input
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  required
                  maxLength={6}
                  placeholder="123456"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="w-full text-center tracking-[0.3em] font-mono text-base font-bold py-2 px-3 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-400 text-neutral-900 dark:text-white placeholder:text-neutral-300"
                />
              </div>

              <div className="flex items-center justify-between text-[11px] pt-0.5">
                <button
                  type="button"
                  onClick={() => setOtpSent(false)}
                  className="text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 underline cursor-pointer"
                >
                  Edit details
                </button>
                <button
                  type="button"
                  disabled={otpCooldown > 0 || submitting}
                  onClick={handleResendOtp}
                  className="text-neutral-600 dark:text-neutral-300 hover:underline cursor-pointer disabled:opacity-50 disabled:no-underline font-medium"
                >
                  {otpCooldown > 0 ? `Resend code in ${otpCooldown}s` : "Resend code"}
                </button>
              </div>

              <div className="pt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => setOtpSent(false)}
                  className="px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={submitting || verificationCode.trim().length < 6}
                  className="flex-1 py-2 rounded-xl text-white text-xs font-semibold shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98 disabled:opacity-50"
                  style={{ backgroundColor: primaryColor }}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <span>Verify & Confirm</span>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* Subview B: Attendee Details Form */
            <form onSubmit={handleConfirmBooking} className="space-y-3">
              <div className="space-y-2 text-xs">
                {/* Full Name */}
                <div>
                  <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="size-3.5 text-neutral-400 absolute left-2 top-2.5" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Alex Morgan"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-7 pr-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:outline-none focus:ring-1 focus:ring-neutral-400"
                    />
                  </div>
                </div>

                {/* Email Address */}
                <div>
                  <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="size-3.5 text-neutral-400 absolute left-2 top-2.5" />
                    <input
                      type="email"
                      required
                      placeholder="e.g. alex@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-7 pr-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:outline-none focus:ring-1 focus:ring-neutral-400"
                    />
                  </div>
                  {slotsData.booking_require_business_email && (
                    <span className="text-[10px] text-neutral-400 mt-0.5 block">
                      Corporate business email required
                    </span>
                  )}
                </div>

                {/* Phone & Company (Responsive 1-col mobile, 2-col wider) */}
                {(showPhone || showCompany) && (
                  <div className={showPhone && showCompany ? "grid grid-cols-1 min-[380px]:grid-cols-2 gap-2" : "space-y-2"}>
                    {showPhone && (
                      <div>
                        <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                          Phone {isPhoneRequired ? <span className="text-red-500">*</span> : "(Optional)"}
                        </label>
                        <div className="relative">
                          <Phone className="size-3.5 text-neutral-400 absolute left-2 top-2.5" />
                          <input
                            type="tel"
                            required={isPhoneRequired}
                            placeholder="+1 555-0199"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full pl-7 pr-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:outline-none focus:ring-1 focus:ring-neutral-400"
                          />
                        </div>
                      </div>
                    )}

                    {showCompany && (
                      <div>
                        <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                          Company {isCompanyRequired ? <span className="text-red-500">*</span> : "(Optional)"}
                        </label>
                        <div className="relative">
                          <Building className="size-3.5 text-neutral-400 absolute left-2 top-2.5" />
                          <input
                            type="text"
                            required={isCompanyRequired}
                            placeholder="Acme Corp"
                            value={company}
                            onChange={(e) => setCompany(e.target.value)}
                            className="w-full pl-7 pr-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:outline-none focus:ring-1 focus:ring-neutral-400"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Notes */}
                <div>
                  <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                    Notes / Discussion Topics (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Share any questions or requirements beforehand..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full p-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:outline-none focus:ring-1 focus:ring-neutral-400 resize-none"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 rounded-xl text-white text-xs font-semibold shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98 disabled:opacity-50"
                  style={{ backgroundColor: primaryColor }}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      <span>{slotsData.booking_email_verification ? "Sending code..." : "Reserving slot..."}</span>
                    </>
                  ) : (
                    <span>{slotsData.booking_email_verification ? "Continue to Verify" : "Confirm Booking"}</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* VIEW 3: Confirmed Meeting Card */}
      {step === 3 && confirmedMeeting && (
        <div className="p-4 space-y-3.5 text-center">
          <div className="size-10 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <Check className="size-5 stroke-[2.5]" />
          </div>

          <div>
            <div className="text-sm font-bold text-neutral-900 dark:text-white">
              Meeting Confirmed!
            </div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 break-words">
              A calendar invitation has been sent to {confirmedMeeting.attendee_email}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/70 border border-neutral-200 dark:border-neutral-700 text-left space-y-2 text-xs">
            <div className="flex items-start gap-2">
              <Calendar className="size-3.5 text-neutral-400 mt-0.5 shrink-0" />
              <div className="font-semibold text-neutral-800 dark:text-neutral-200 leading-snug">
                {confirmedMeeting.formatted_time}
              </div>
            </div>
            <div className="flex items-start gap-2">
              <User className="size-3.5 text-neutral-400 mt-0.5 shrink-0" />
              <div className="text-neutral-600 dark:text-neutral-400 break-all">
                {confirmedMeeting.attendee_name} ({confirmedMeeting.attendee_email})
              </div>
            </div>
            {confirmedMeeting.assigned_to_email && (
              <div className="flex items-start gap-2">
                <ShieldCheck className="size-3.5 text-neutral-400 mt-0.5 shrink-0" />
                <div className="text-neutral-500 dark:text-neutral-400 text-[11px] break-all">
                  Host: {confirmedMeeting.assigned_to_email}
                </div>
              </div>
            )}
          </div>

          {/* Join Call Button */}
          {confirmedMeeting.meeting_link && (
            <a
              href={confirmedMeeting.meeting_link}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 px-3 rounded-xl text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-all hover:opacity-95"
              style={{ backgroundColor: primaryColor }}
            >
              <Video className="size-4" />
              <span>Join Video Call</span>
              <ExternalLink className="size-3 opacity-70" />
            </a>
          )}

          {/* Add to Calendar Actions */}
          <div className="pt-1 flex items-center justify-center gap-3 text-xs">
            <a
              href={getGoogleCalendarUrl(confirmedMeeting)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
            >
              <CalendarPlus className="size-3.5 text-neutral-400" />
              <span>Google Calendar</span>
            </a>
            <span className="text-neutral-300 dark:text-neutral-700">|</span>
            <button
              type="button"
              onClick={() => downloadIcs(confirmedMeeting)}
              className="inline-flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <Calendar className="size-3.5 text-neutral-400" />
              <span>Download .ics</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default InlineBookingCard;
