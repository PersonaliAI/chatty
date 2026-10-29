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
  ArrowRight,
  ExternalLink,
  AudioWaveform,
  Smile,
  Paperclip,
  Send,
  Star,
  Check,
  Search,
  ArrowLeft,
  Lock,
  Keyboard,
  ShieldCheck,
  Clock,
  MapPin,
  Mic,
  CalendarCheck,
  Zap,
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
    businessCategory: "Electronics · Official Store",
    businessAvatarBg: "bg-[#1f2937]",
    businessIcon: "keyboard",
    badgeText: "Catalog & Buy",
    userMessage: "Looking for an ergonomic mechanical keyboard for Mac with Bluetooth under $100.",
    userTime: "10:14 AM",
    botMessage: "Here is our top-rated Mac mechanical keyboard in stock: *Keychron K2 Pro Wireless* (Hot-swappable RGB, Bluetooth 5.1 & Type-C, 4000mAh battery).",
    botTime: "10:14 AM",
    type: "product",
  },
  {
    id: "policy",
    tabLabel: "Policy & Returns",
    businessName: "Aura Apparel & Footwear",
    businessCategory: "Fashion & Retail · Verified",
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
    businessCategory: "Medical & Wellness · Clinic",
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
    tabLabel: "LiveKit Voice AI",
    businessName: "HyperDrive Global Logistics",
    businessCategory: "Freight & Delivery · 24/7",
    businessAvatarBg: "bg-[#2563eb]",
    businessIcon: "logistics",
    badgeText: "Voice Note & LiveKit",
    isVoiceNoteUser: true,
    userVoiceDuration: "0:14",
    userMessage: "Can you check order #HD-8921 status and estimated delivery time?",
    userTime: "10:17 AM",
    botMessage: "Order #HD-8921 is currently in transit on DHL Flight 402, arriving tomorrow by 1:30 PM. Speak directly with our LiveKit voice agent anytime!",
    botTime: "10:17 AM",
    type: "voice",
  },
];

const SLIDE_DURATION = 6500; // 6.5 seconds per situation

export function AnimatedHeroChat({ onOpenVoice }: { onOpenVoice?: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [cartAdded, setCartAdded] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string>("2:00 PM EST");
  const [voicePlaying, setVoicePlaying] = useState(false);
  const [activeQuickReply, setActiveQuickReply] = useState<string | null>(null);

  const current = BUSINESS_SITUATIONS[currentIndex];

  // Rock-solid auto-slider using requestAnimationFrame delta timing
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const delta = now - lastTime;
      lastTime = now;

      if (!isPaused) {
        setElapsed((prev) => {
          const next = prev + delta;
          if (next >= SLIDE_DURATION) {
            setCurrentIndex((curr) => (curr + 1) % BUSINESS_SITUATIONS.length);
            setCartAdded(false);
            setVoicePlaying(false);
            setActiveQuickReply(null);
            return 0;
          }
          return next;
        });
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isPaused]);

  // Derived animation stage from elapsed time (zero timer conflicts, zero race conditions)
  // Stage 0 (0-600ms): User message pops in, status "online"
  // Stage 1 (600-1700ms): Header shows "typing...", 3 bouncing green dots appear
  // Stage 2 (1700-2400ms): Bot response bubble appears, double blue checks activate
  // Stage 3 (2400ms+): WhatsApp rich interactive card (product/policy/calendar/voice) slides in
  const animStage = elapsed < 600 ? 0 : elapsed < 1700 ? 1 : elapsed < 2400 ? 2 : 3;

  const selectSituation = (idx: number) => {
    setCurrentIndex(idx);
    setElapsed(0);
    setCartAdded(false);
    setVoicePlaying(false);
    setActiveQuickReply(null);
  };

  const renderBusinessAvatarIcon = (type: BusinessSituation["businessIcon"]) => {
    switch (type) {
      case "keyboard":
        return <Keyboard className="size-5 text-white" />;
      case "apparel":
        return <ShoppingBag className="size-5 text-white" />;
      case "health":
        return <Sparkles className="size-5 text-white" />;
      case "logistics":
        return <Zap className="size-5 text-white" />;
    }
  };

  return (
    <div className="relative max-w-[700px] mx-auto rounded-[28px] overflow-hidden border border-black/12 bg-[#efeae2] shadow-[0_25px_70px_-15px_rgba(46,43,37,0.22)] text-left select-none transition-all">
      {/* 1. WhatsApp Story Segmented Auto-Slider Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 bg-[#005c4b] text-white">
        <div className="flex items-center gap-1.5 flex-1 mr-3">
          {BUSINESS_SITUATIONS.map((sit, i) => {
            let widthPct = "0%";
            if (i < currentIndex) {
              widthPct = "100%";
            } else if (i === currentIndex) {
              widthPct = `${Math.min(100, (elapsed / SLIDE_DURATION) * 100)}%`;
            }
            return (
              <button
                key={sit.id}
                type="button"
                onClick={() => selectSituation(i)}
                className="flex-1 h-1.5 rounded-full overflow-hidden bg-white/25 transition-all hover:h-2 cursor-pointer relative"
                aria-label={`Jump to ${sit.businessName}`}
                title={sit.tabLabel}
              >
                <div
                  className="h-full bg-white transition-all duration-75 rounded-full shadow-2xs"
                  style={{ width: widthPct }}
                />
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setIsPaused(!isPaused)}
          className="text-[11px] font-semibold text-emerald-100 hover:text-white px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 transition cursor-pointer shrink-0"
          title={isPaused ? "Resume auto slide" : "Pause auto slide"}
        >
          {isPaused ? "▶ Resume" : "⏸ Pause"}
        </button>
      </div>

      {/* 2. Authentic WhatsApp Mobile/Web Header */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 bg-[#008069] text-white shadow-xs">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button type="button" className="p-1 hover:bg-white/10 rounded-full transition" aria-label="Back">
            <ArrowLeft className="size-4.5 sm:size-5 text-white" />
          </button>

          {/* Business Avatar with Verified Badge */}
          <div className="relative shrink-0">
            <div
              className={`size-10 rounded-full ${current.businessAvatarBg} border border-white/25 flex items-center justify-center font-bold text-white shadow-xs`}
            >
              {renderBusinessAvatarIcon(current.businessIcon)}
            </div>
            <span
              className="absolute -bottom-0.5 -right-0.5 size-4 rounded-full bg-[#25d366] text-white flex items-center justify-center border-2 border-[#008069] text-[9px] font-bold shadow-2xs"
              title="WhatsApp Verified Official Business"
            >
              ✓
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
                <span>Business Account · LiveKit Audio</span>
              ) : (
                <span>Business Account · Instant AI</span>
              )}
            </p>
          </div>
        </div>

        {/* WhatsApp Top Right Action Icons */}
        <div className="flex items-center gap-1 sm:gap-2 text-white shrink-0">
          {onOpenVoice && (
            <button
              type="button"
              onClick={onOpenVoice}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 hover:bg-white/30 border border-white/25 text-white text-[11px] font-semibold transition shadow-xs cursor-pointer"
              title="Test LiveKit Voice AI"
            >
              <AudioWaveform className="size-3 text-emerald-200 animate-pulse" />
              <span className="hidden sm:inline">Voice Call</span>
            </button>
          )}
          <button type="button" className="p-1.5 hover:bg-white/10 rounded-full transition" aria-label="Video Call">
            <Video className="size-4.5" />
          </button>
          <button type="button" className="p-1.5 hover:bg-white/10 rounded-full transition" aria-label="Voice Call">
            <Phone className="size-4" />
          </button>
          <button type="button" className="p-1.5 hover:bg-white/10 rounded-full transition" aria-label="More Options">
            <MoreVertical className="size-4.5" />
          </button>
        </div>
      </div>

      {/* 3. WhatsApp Chat Body with Authentic Doodle Canvas */}
      <div
        className="p-3 sm:p-5 space-y-3 min-h-[360px] flex flex-col justify-end relative"
        style={{
          backgroundColor: "#efeae2",
          backgroundImage:
            "radial-gradient(#cfc7bc 0.85px, transparent 0.85px), radial-gradient(#cfc7bc 0.85px, #efeae2 0.85px)",
          backgroundSize: "24px 24px",
          backgroundPosition: "0 0, 12px 12px",
        }}
      >
        {/* End-to-End Encryption Notice Banner */}
        <div className="flex justify-center mb-1">
          <div className="max-w-[480px] px-3 py-1.5 rounded-lg bg-[#ffeecd] border border-[#f3d99d] text-[11px] text-[#54656f] text-center shadow-2xs flex items-center justify-center gap-1.5">
            <Lock className="size-3 text-[#54656f] shrink-0" />
            <span>Messages and calls are end-to-end encrypted. No one outside of this chat can read them.</span>
          </div>
        </div>

        {/* Date Separator Pill */}
        <div className="flex justify-center mb-1">
          <span className="px-3 py-0.5 rounded-md bg-white/80 backdrop-blur-xs text-[10.5px] font-semibold text-[#54656f] shadow-2xs uppercase tracking-wider">
            Today · {current.badgeText}
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
                  {voicePlaying ? <Pause className="size-4" /> : <Play className="size-4 ml-0.5" />}
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
                  <div className="flex justify-between text-[10px] text-emerald-900/70 font-medium">
                    <span>{current.userVoiceDuration}</span>
                    <span>Voice Memo · LiveKit</span>
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
                        <span className="text-[9.5px] uppercase font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300/60">
                          In Stock · Mac &amp; Windows
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
                                <Check className="size-3" />
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
                      {["Request Return Label", "Track Package", "Human Agent"].map((btnText) => (
                        <button
                          key={btnText}
                          type="button"
                          onClick={() => setActiveQuickReply(btnText)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition cursor-pointer flex items-center gap-1 ${
                            activeQuickReply === btnText
                              ? "bg-[#008069] text-white border-[#008069]"
                              : "bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50"
                          }`}
                        >
                          {activeQuickReply === btnText && <Check className="size-3" />}
                          <span>{btnText}</span>
                        </button>
                      ))}
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
                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                              isSelected
                                ? "bg-[#008069] text-white shadow-2xs"
                                : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                            }`}
                          >
                            {isSelected && <Check className="size-3" />}
                            <span>{slot}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-teal-800 bg-teal-50 p-2 rounded-lg border border-teal-200/60 font-medium">
                      <Calendar className="size-3.5 text-teal-700 shrink-0" />
                      <span>Google Meet &amp; Calendar invite confirmed for {selectedSlot}.</span>
                    </div>
                  </div>
                )}

                {/* Sub-widget: Situation 3 (LiveKit Voice AI Card) */}
                {current.type === "voice" && animStage >= 3 && (
                  <div className="pt-2 border-t border-neutral-100 animate-in fade-in zoom-in-95 duration-300 space-y-2">
                    <div className="p-2 rounded-xl bg-emerald-50/90 border border-emerald-200 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-emerald-500 animate-ping" />
                        <span className="font-semibold text-emerald-950">LiveKit Cloud WebRTC Audio</span>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded">
                        280ms latency
                      </span>
                    </div>
                    {onOpenVoice && (
                      <button
                        type="button"
                        onClick={onOpenVoice}
                        className="w-full py-2 rounded-xl text-xs font-bold text-white transition shadow-sm hover:brightness-105 cursor-pointer flex items-center justify-center gap-2"
                        style={{ background: "var(--color-accent)" }}
                      >
                        <AudioWaveform className="size-4" />
                        <span>Speak with LiveKit Voice AI Now</span>
                      </button>
                    )}
                  </div>
                )}

                <div className="flex justify-end text-[10px] text-[#667781] pt-0.5">
                  <span>{current.botTime}</span>
                </div>
              </div>
            </div>
          </div>
        )}
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
          onClick={onOpenVoice}
          className="size-8.5 rounded-full bg-[#008069] text-white flex items-center justify-center hover:bg-emerald-800 transition shadow-2xs cursor-pointer"
          aria-label="Send or Voice"
        >
          <Mic className="size-4 text-white" />
        </button>
      </div>

      {/* 5. Various Businesses Switcher Pills with Brand Icons */}
      <div className="flex items-center justify-center gap-1.5 p-2 bg-[#e9edef] border-t border-black/8 overflow-x-auto scrollbar-none">
        {BUSINESS_SITUATIONS.map((sit, i) => {
          const isActive = i === currentIndex;
          return (
            <button
              key={sit.id}
              type="button"
              onClick={() => selectSituation(i)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                isActive
                  ? "bg-[#008069] text-white shadow-2xs scale-102"
                  : "bg-white text-neutral-700 hover:text-neutral-900 border border-black/5"
              }`}
            >
              <span className="size-4 rounded-full flex items-center justify-center text-[10px]">
                {sit.businessIcon === "keyboard" && "⌨️"}
                {sit.businessIcon === "apparel" && "🛍️"}
                {sit.businessIcon === "health" && "✨"}
                {sit.businessIcon === "logistics" && "⚡"}
              </span>
              <span>{sit.tabLabel}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}