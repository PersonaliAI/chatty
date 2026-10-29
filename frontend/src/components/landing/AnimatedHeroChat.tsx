"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import {
  Phone,
  Video,
  MoreVertical,
  CheckCheck,
  Play,
  Pause,
  ShoppingBag,
  Calendar,
  Sparkles,
  BookOpen,
  AudioWaveform,
  Smile,
  Paperclip,
  Star,
  Check,
  ArrowLeft,
  Lock,
  Keyboard,
  Clock,
  Mic,
  CalendarCheck,
  Truck,
  RotateCcw,
} from "lucide-react";

interface BusinessSituation {
  id: string;
  tabLabel: string;
  businessName: string;
  businessCategory: string;
  businessAvatarBg: string;
  businessIcon: "keyboard" | "apparel" | "health" | "logistics";
  badgeText: string;
  userMessage: string;
  userTime: string;
  isVoiceNoteUser?: boolean;
  userVoiceDuration?: string;
  botMessage: string;
  botTime: string;
  type: "product" | "policy" | "calendar" | "voice";
}

const BUSINESS_SITUATIONS: BusinessSituation[] = [
  {
    id: "product",
    tabLabel: "E-Commerce",
    businessName: "Keychron Official Store",
    businessCategory: "Consumer Electronics · Official Store",
    businessAvatarBg: "bg-[#1f2937]",
    businessIcon: "keyboard",
    badgeText: "Catalog & Buy",
    userMessage: "Looking for an ergonomic mechanical keyboard for Mac with Bluetooth under $100.",
    userTime: "10:14 AM",
    botMessage: "Here is our top-rated Mac mechanical keyboard in stock: Keychron K2 Pro Wireless (Hot-swappable RGB, Bluetooth 5.1 & Type-C, 4000mAh battery).",
    botTime: "10:14 AM",
    type: "product",
  },
  {
    id: "policy",
    tabLabel: "Policy & Returns",
    businessName: "Aura Apparel & Footwear",
    businessCategory: "Fashion & Retail · Verified Business",
    businessAvatarBg: "bg-[#c67139]",
    businessIcon: "apparel",
    badgeText: "Instant Policy",
    userMessage: "Do you ship internationally to Germany, and can I return an item if the package was opened?",
    userTime: "10:15 AM",
    botMessage: "Yes! We ship to Germany in 2-3 business days via DHL Express. Under our 30-day guarantee, opened items are 100% eligible for free replacement or full refund.",
    botTime: "10:15 AM",
    type: "policy",
  },
  {
    id: "calendar",
    tabLabel: "Meeting Booking",
    businessName: "Lumina Health & Aesthetics",
    businessCategory: "Medical & Wellness · Clinic Schedule",
    businessAvatarBg: "bg-[#0d9488]",
    businessIcon: "health",
    badgeText: "Calendar Sync",
    userMessage: "Can I book a 20-min consultation demo for tomorrow afternoon?",
    userTime: "10:16 AM",
    botMessage: "I checked Dr. Aris's live calendar. Here are 3 available consultation slots for tomorrow afternoon:",
    botTime: "10:16 AM",
    type: "calendar",
  },
  {
    id: "voice",
    tabLabel: "Voice Notes",
    businessName: "HyperDrive Global Logistics",
    businessCategory: "Freight & Delivery · Verified WhatsApp Business",
    businessAvatarBg: "bg-[#2563eb]",
    businessIcon: "logistics",
    badgeText: "Voice Note AI",
    isVoiceNoteUser: true,
    userVoiceDuration: "0:14",
    userMessage: "Can you check order #HD-8921 status and estimated delivery time?",
    userTime: "10:17 AM",
    botMessage: "Order #HD-8921 is currently in transit on DHL Flight 402, arriving tomorrow by 1:30 PM. Signature is required upon delivery.",
    botTime: "10:17 AM",
    type: "voice",
  },
];

const SLIDE_DURATION_MS = 7500; // 7.5 seconds per situation for calm, readable pacing
const TICK_MS = 50;
const STEP = 100 / (SLIDE_DURATION_MS / TICK_MS);

export function AnimatedHeroChat() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [animStage, setAnimStage] = useState(0);
  const [cartAdded, setCartAdded] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string>("2:00 PM EST");
  const [voicePlaying, setVoicePlaying] = useState(false);
  const [activeQuickReply, setActiveQuickReply] = useState<string | null>(null);

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Modern auto-scroll: smoothly scroll to the newest message or interactive card as animation stages progress
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: animStage === 0 ? "auto" : "smooth",
      });
    }
  }, [animStage, currentIndex]);

  const current = BUSINESS_SITUATIONS[currentIndex];

  // 1. Smooth, decoupled progress timer
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) return 100;
        return Math.min(100, prev + STEP);
      });
    }, TICK_MS);

    return () => clearInterval(interval);
  }, [isPaused, currentIndex]);

  // 2. Deterministic slide advance when progress hits 100%
  useEffect(() => {
    if (progress >= 100) {
      const timeout = setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % BUSINESS_SITUATIONS.length);
        setProgress(0);
      }, 80);
      return () => clearTimeout(timeout);
    }
  }, [progress]);

  // 3. Staged animation timeline per slide
  useEffect(() => {
    setAnimStage(0);
    setCartAdded(false);
    setVoicePlaying(false);
    setActiveQuickReply(null);

    const t1 = setTimeout(() => setAnimStage(1), 700);  // 0.7s: typing indicator starts
    const t2 = setTimeout(() => setAnimStage(2), 2000); // 2.0s: bot response pops in
    const t3 = setTimeout(() => setAnimStage(3), 2800); // 2.8s: rich interactive card slides in

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [currentIndex]);

  const selectSituation = (idx: number) => {
    setCurrentIndex(idx);
    setProgress(0);
    setCartAdded(false);
    setVoicePlaying(false);
    setActiveQuickReply(null);
  };

  const renderBusinessIcon = (icon: BusinessSituation["businessIcon"], className: string) => {
    switch (icon) {
      case "keyboard":
        return <Keyboard className={className} />;
      case "apparel":
        return <ShoppingBag className={className} />;
      case "health":
        return <Sparkles className={className} />;
      case "logistics":
        return <Truck className={className} />;
    }
  };

  return (
    <div className="relative max-w-[700px] mx-auto rounded-[28px] overflow-hidden border border-black/12 bg-[#efeae2] shadow-[0_25px_70px_-15px_rgba(46,43,37,0.22)] text-left select-none transition-all">
      {/* 1. WhatsApp Story Segmented Auto-Slider Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 bg-[#005c4b] text-white">
        <div className="flex items-center gap-1.5 sm:gap-2 flex-1 mr-3">
          {BUSINESS_SITUATIONS.map((sit, i) => {
            let fillPct = 0;
            if (i < currentIndex) fillPct = 100;
            else if (i === currentIndex) fillPct = progress;
            else fillPct = 0;

            return (
              <button
                key={sit.id}
                type="button"
                onClick={() => selectSituation(i)}
                className="flex-1 h-2 rounded-full overflow-hidden bg-white/20 transition-all hover:h-2.5 cursor-pointer relative"
                aria-label={`Jump to ${sit.businessName}`}
                title={sit.tabLabel}
              >
                <div
                  className="h-full bg-white rounded-full transition-all duration-75"
                  style={{ width: `${fillPct}%` }}
                />
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setIsPaused(!isPaused)}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-100 hover:text-white px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 transition cursor-pointer shrink-0"
          title={isPaused ? "Resume auto slide" : "Pause auto slide"}
        >
          {isPaused ? (
            <>
              <Play className="size-3 fill-white text-white" />
              <span>Resume</span>
            </>
          ) : (
            <>
              <Pause className="size-3 fill-white text-white" />
              <span>Pause</span>
            </>
          )}
        </button>
      </div>

      {/* 2. Authentic WhatsApp Mobile/Web Header */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 bg-[#008069] text-white shadow-xs">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button type="button" className="p-1 hover:bg-white/10 rounded-full transition" aria-label="Back">
            <ArrowLeft className="size-4.5 sm:size-5 text-white" />
          </button>

          {/* Business Avatar with Verified Check Badge */}
          <div className="relative shrink-0">
            <div
              className={`size-10 rounded-full ${current.businessAvatarBg} border border-white/25 flex items-center justify-center font-bold text-white shadow-xs`}
            >
              {renderBusinessIcon(current.businessIcon, "size-5 text-white")}
            </div>
            <span
              className="absolute -bottom-0.5 -right-0.5 size-4 rounded-full bg-[#25d366] text-white flex items-center justify-center border-2 border-[#008069] shadow-2xs"
              title="WhatsApp Verified Official Business"
            >
              <Check className="size-2.5 text-white stroke-[3]" />
            </span>
          </div>

          {/* Business Name and Online/Typing Status */}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h4 className="font-semibold text-[13.5px] sm:text-[14.5px] tracking-tight text-white leading-tight truncate">
                {current.businessName}
              </h4>
            </div>
            <p className="text-[11px] text-emerald-100 flex items-center gap-1 leading-tight mt-0.5 truncate">
              {animStage === 1 ? (
                <span className="text-emerald-200 font-bold animate-pulse">typing...</span>
              ) : current.type === "voice" ? (
                <span>Business Account · Voice Note AI</span>
              ) : (
                <span>Business Account · Instant AI</span>
              )}
            </p>
          </div>
        </div>

        {/* WhatsApp Top Right Action Icons */}
        <div className="flex items-center gap-1 sm:gap-2 text-white shrink-0">
          <button type="button" className="p-1.5 hover:bg-white/10 rounded-full transition cursor-pointer" aria-label="Video Call">
            <Video className="size-4.5" />
          </button>
          <button type="button" className="p-1.5 hover:bg-white/10 rounded-full transition cursor-pointer" aria-label="Voice Call">
            <Phone className="size-4" />
          </button>
          <button type="button" className="p-1.5 hover:bg-white/10 rounded-full transition cursor-pointer" aria-label="More Options">
            <MoreVertical className="size-4.5" />
          </button>
        </div>
      </div>

      {/* 3. WhatsApp Chat Body with Authentic Doodle Canvas & Modern Auto-Scroll */}
      <div
        ref={chatScrollRef}
        className="h-[430px] sm:h-[470px] overflow-y-auto chatty-custom-scrollbar scroll-smooth p-3 sm:p-5 relative"
        style={{
          backgroundColor: "#efeae2",
          backgroundImage:
            "radial-gradient(#cfc7bc 0.85px, transparent 0.85px), radial-gradient(#cfc7bc 0.85px, #efeae2 0.85px)",
          backgroundSize: "24px 24px",
          backgroundPosition: "0 0, 12px 12px",
        }}
      >
        <div className="min-h-full flex flex-col justify-end space-y-3">
        {/* End-to-End Encryption Notice Banner */}
        <div className="flex justify-center mb-1">
          <div className="max-w-[480px] px-3 py-1.5 rounded-lg bg-[#ffeecd] border border-[#f3d99d] text-[11px] text-[#54656f] text-center shadow-2xs flex items-center justify-center gap-1.5">
            <Lock className="size-3 text-[#54656f] shrink-0" />
            <span>Messages and calls are end-to-end encrypted. No one outside of this chat can read them.</span>
          </div>
        </div>

        {/* Date Separator Pill */}
        <div className="flex justify-center mb-1">
          <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-md bg-white/80 backdrop-blur-xs text-[10.5px] font-semibold text-[#54656f] shadow-2xs uppercase tracking-wider">
            <Clock className="size-3 text-[#54656f]" />
            <span>Today · {current.badgeText}</span>
          </span>
        </div>

        {/* User Message Bubble (WhatsApp Outgoing Style: Right-Aligned, #d9fdd3) */}
        <div
          className={`flex justify-end transition-all duration-300 ${
            animStage >= 0 ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-2 scale-95"
          }`}
        >
          <div className="relative max-w-[85%] sm:max-w-[76%] rounded-2xl rounded-tr-xs p-3 bg-[#d9fdd3] text-[#111b21] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] border border-emerald-900/10 space-y-1">
            {current.isVoiceNoteUser ? (
              <div className="flex items-center gap-3 py-1 min-w-[220px]">
                <button
                  type="button"
                  onClick={() => setVoicePlaying(!voicePlaying)}
                  className="size-8.5 rounded-full bg-[#008069] text-white flex items-center justify-center shrink-0 shadow-xs hover:scale-105 transition cursor-pointer"
                  aria-label="Play voice note"
                >
                  {voicePlaying ? (
                    <Pause className="size-4 fill-white text-white" />
                  ) : (
                    <Play className="size-4 fill-white text-white ml-0.5" />
                  )}
                </button>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-1 h-5">
                    {[35, 60, 95, 45, 80, 100, 70, 50, 85, 40, 65, 30, 80, 55].map((h, i) => (
                      <span
                        key={i}
                        className={`w-1 rounded-full transition-all ${
                          voicePlaying ? "bg-[#008069] animate-pulse" : "bg-[#008069]/70"
                        }`}
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-emerald-900/70 font-medium">
                    <span>{current.userVoiceDuration}</span>
                    <span className="flex items-center gap-1">
                      <AudioWaveform className="size-2.5" />
                      <span>Voice Memo</span>
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs sm:text-[13.5px] leading-relaxed text-[#111b21]">{current.userMessage}</p>
            )}

            <div className="flex items-center justify-end gap-1 text-[10.5px] text-[#667781] pt-0.5">
              <span>{current.userTime}</span>
              <CheckCheck className={`size-3.5 ${animStage >= 2 ? "text-[#53bdeb]" : "text-[#8696a0]"}`} />
            </div>
          </div>
        </div>

        {/* WhatsApp Typing Indicator (Stage 1) */}
        {animStage === 1 && (
          <div className="flex items-start gap-2 animate-in fade-in zoom-in-95 duration-200">
            <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-xs bg-white text-[#54656f] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] border border-black/5 flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-[#25d366] animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="size-1.5 rounded-full bg-[#25d366] animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="size-1.5 rounded-full bg-[#25d366] animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}

        {/* Chatty Bot Message Bubble (WhatsApp Incoming Style: Left-Aligned, #ffffff) */}
        {animStage >= 2 && (
          <div className="flex items-start gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="max-w-[92%] sm:max-w-[86%] space-y-2">
              <div className="rounded-2xl rounded-tl-xs p-3.5 bg-white text-[#111b21] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] border border-black/5 space-y-2.5">
                <p className="text-xs sm:text-[13.5px] leading-relaxed font-normal">{current.botMessage}</p>

                {/* Sub-widget: Situation 0 (E-Commerce Product Card) */}
                {current.type === "product" && animStage >= 3 && (
                  <div className="pt-2 border-t border-neutral-100 animate-in fade-in zoom-in-95 duration-300">
                    <div className="rounded-xl border border-black/8 bg-neutral-50/80 p-2.5 sm:p-3 flex items-center gap-3">
                      <div className="relative size-16 sm:size-20 rounded-lg overflow-hidden bg-neutral-200 shrink-0 border border-black/5">
                        <Image
                          src="/products/keyboard-pro.jpg"
                          alt="Keychron K2 Pro Mechanical Keyboard"
                          fill
                          className="object-cover"
                          sizes="80px"
                        />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <span className="inline-flex items-center gap-1 text-[9.5px] uppercase font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300/60">
                          <span className="size-1.5 rounded-full bg-emerald-600" />
                          <span>In Stock · Mac &amp; Windows</span>
                        </span>
                        <h5 className="text-xs font-bold text-neutral-900 truncate">Keychron K2 Pro Wireless RGB</h5>
                        <div className="flex items-center gap-1 text-[11px] text-amber-500 font-medium">
                          <Star className="size-3 fill-amber-400 text-amber-400" />
                          <span>4.9 (342 reviews)</span>
                        </div>
                        <div className="flex items-center justify-between pt-0.5">
                          <span className="font-bold text-xs text-neutral-900">$89.00 <span className="line-through text-neutral-400 text-[10px]">$119.00</span></span>
                          <button
                            type="button"
                            onClick={() => setCartAdded(!cartAdded)}
                            className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#008069] text-white hover:bg-emerald-800 transition shadow-2xs cursor-pointer flex items-center gap-1"
                          >
                            {cartAdded ? (
                              <>
                                <Check className="size-3 stroke-[2.5]" />
                                <span>Added!</span>
                              </>
                            ) : (
                              <>
                                <ShoppingBag className="size-3" />
                                <span>Add to Cart</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sub-widget: Situation 1 (Policy Verified Card + WhatsApp Quick Replies) */}
                {current.type === "policy" && animStage >= 3 && (
                  <div className="pt-2 border-t border-neutral-100 animate-in fade-in zoom-in-95 duration-300 space-y-2">
                    <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 bg-emerald-50 p-2 rounded-lg border border-emerald-200/60 font-medium">
                      <BookOpen className="size-3.5 text-emerald-700 shrink-0" />
                      <span>Verified from Shipping &amp; Returns Policy (Section 3.2)</span>
                    </div>
                    {/* WhatsApp Quick Reply Action Pills */}
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {[
                        { label: "Request Return Label", icon: RotateCcw },
                        { label: "Track Package", icon: Truck },
                        { label: "Human Agent", icon: Phone },
                      ].map((item) => {
                        const Icon = item.icon;
                        const isSelected = activeQuickReply === item.label;
                        return (
                          <button
                            key={item.label}
                            type="button"
                            onClick={() => setActiveQuickReply(item.label)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
                              isSelected
                                ? "bg-[#008069] text-white border-[#008069]"
                                : "bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50"
                            }`}
                          >
                            {isSelected ? <Check className="size-3 stroke-[2.5]" /> : <Icon className="size-3" />}
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Sub-widget: Situation 2 (Calendar Booking Slots) */}
                {current.type === "calendar" && animStage >= 3 && (
                  <div className="pt-2 border-t border-neutral-100 animate-in fade-in zoom-in-95 duration-300 space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {["2:00 PM EST", "3:30 PM EST", "4:45 PM EST"].map((slot) => {
                        const isSelected = selectedSlot === slot;
                        return (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setSelectedSlot(slot)}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                              isSelected
                                ? "bg-[#008069] text-white shadow-2xs"
                                : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                            }`}
                          >
                            {isSelected ? <Check className="size-3 stroke-[2.5]" /> : <Clock className="size-3" />}
                            <span>{slot}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-teal-800 bg-teal-50 p-2 rounded-lg border border-teal-200/60 font-medium">
                      <CalendarCheck className="size-3.5 text-teal-700 shrink-0" />
                      <span>Google Meet &amp; Calendar invite confirmed for {selectedSlot}.</span>
                    </div>
                  </div>
                )}

                {/* Sub-widget: Situation 3 (Voice Note Transcription & Live Status Card) */}
                {current.type === "voice" && animStage >= 3 && (
                  <div className="pt-2 border-t border-neutral-100 animate-in fade-in zoom-in-95 duration-300 space-y-2">
                    <div className="p-2.5 rounded-xl bg-emerald-50/90 border border-emerald-200/80 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <AudioWaveform className="size-3.5 text-emerald-700 shrink-0" />
                        <span className="font-semibold text-emerald-950">Voice Note Transcribed &amp; DHL Verified</span>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded">
                        Live Tracking
                      </span>
                    </div>
                    {/* WhatsApp Quick Reply Action Pills */}
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {[
                        { label: "Play Audio Memo", icon: Play },
                        { label: "Live GPS Tracking", icon: Truck },
                        { label: "Transfer to Human", icon: Phone },
                      ].map((item) => {
                        const Icon = item.icon;
                        const isSelected = activeQuickReply === item.label;
                        return (
                          <button
                            key={item.label}
                            type="button"
                            onClick={() => {
                              setActiveQuickReply(item.label);
                              if (item.label === "Play Audio Memo") {
                                setVoicePlaying(!voicePlaying);
                              }
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
                              isSelected
                                ? "bg-[#008069] text-white border-[#008069]"
                                : "bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50"
                            }`}
                          >
                            <Icon className="size-3" />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex justify-end text-[10px] text-[#667781] pt-0.5">
                  <span>{current.botTime}</span>
                </div>
              </div>
            </div>
          </div>
        )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 4. WhatsApp Bottom Input Mockup Bar */}
      <div className="px-3 py-2 bg-[#f0f2f5] border-t border-black/5 flex items-center gap-2 text-[#54656f]">
        <button type="button" className="p-1 hover:text-neutral-700 transition" aria-label="Emoji">
          <Smile className="size-5" />
        </button>
        <button type="button" className="p-1 hover:text-neutral-700 transition" aria-label="Attach File">
          <Paperclip className="size-5" />
        </button>
        <div className="flex-1 px-3.5 py-1.5 rounded-full bg-white border border-neutral-300/80 text-xs text-[#8696a0] shadow-2xs">
          Type a message...
        </div>
        <button
          type="button"
          onClick={() => setVoicePlaying(!voicePlaying)}
          className="size-8.5 rounded-full bg-[#008069] text-white flex items-center justify-center hover:bg-emerald-800 transition shadow-2xs cursor-pointer"
          aria-label="Record voice memo"
          title="Record voice memo"
        >
          <Mic className="size-4 text-white" />
        </button>
      </div>

      {/* 5. 4-Item Grid: Guaranteed 100% Visibility of All Slider Items with Lucide Icons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 sm:p-3 bg-[#e9edef] border-t border-black/8">
        {BUSINESS_SITUATIONS.map((sit, i) => {
          const isActive = i === currentIndex;
          return (
            <button
              key={sit.id}
              type="button"
              onClick={() => selectSituation(i)}
              className={`px-2.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center sm:justify-start gap-2 border ${
                isActive
                  ? "bg-[#008069] text-white border-[#008069] shadow-sm"
                  : "bg-white text-neutral-700 hover:text-neutral-900 border-black/8 hover:bg-neutral-50"
              }`}
            >
              <span
                className={`size-6 rounded-lg flex items-center justify-center shrink-0 ${
                  isActive ? "bg-white/20 text-white" : `${sit.businessAvatarBg} text-white`
                }`}
              >
                {renderBusinessIcon(sit.businessIcon, "size-3.5 text-white")}
              </span>
              <span className="truncate">{sit.tabLabel}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
