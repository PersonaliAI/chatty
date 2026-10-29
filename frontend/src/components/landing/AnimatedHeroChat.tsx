"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
} from "lucide-react";

interface Situation {
  id: string;
  tabLabel: string;
  tag: string;
  userMessage: string;
  userTime: string;
  isVoiceNoteUser?: boolean;
  userVoiceDuration?: string;
  botMessage: string;
  botTime: string;
  type: "policy" | "product" | "voice" | "calendar";
}

const SITUATIONS: Situation[] = [
  {
    id: "policy",
    tabLabel: "Policy & Returns",
    tag: "Instant Resolution",
    userMessage: "Do you ship to Germany, and what is your return policy if the box was opened?",
    userTime: "10:41 AM",
    botMessage: "Yes! We ship to Germany in 2-3 business days via DHL Express. Under our 30-day guarantee, opened boxes are 100% eligible for free exchange or refund.",
    botTime: "10:41 AM",
    type: "policy",
  },
  {
    id: "product",
    tabLabel: "Catalog & Cart",
    tag: "E-Commerce",
    userMessage: "Looking for an ergonomic mechanical keyboard for Mac with Bluetooth under $120.",
    userTime: "10:42 AM",
    botMessage: "Here is our top-rated Mac mechanical keyboard in stock with free next-day dispatch:",
    botTime: "10:42 AM",
    type: "product",
  },
  {
    id: "voice",
    tabLabel: "Voice Note",
    tag: "LiveKit Audio",
    isVoiceNoteUser: true,
    userVoiceDuration: "0:12",
    userMessage: "Can you check if my order #CH-88219 has dispatched?",
    userTime: "10:43 AM",
    botMessage: "Order #CH-88219 is on DHL Express flight 402, arriving tomorrow by 2:00 PM. Tap below to speak with our LiveKit voice agent anytime!",
    botTime: "10:43 AM",
    type: "voice",
  },
  {
    id: "calendar",
    tabLabel: "Meeting Booking",
    tag: "Calendar Sync",
    userMessage: "Can we schedule a 20-minute product onboarding demo with your team tomorrow?",
    userTime: "10:44 AM",
    botMessage: "I have checked our team calendar. Select a slot that works best for you:",
    botTime: "10:44 AM",
    type: "calendar",
  },
];

const SITUATION_DURATION = 7500; // 7.5 seconds per situation

export function AnimatedHeroChat({ onOpenVoice }: { onOpenVoice?: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [animStage, setAnimStage] = useState<number>(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [cartAdded, setCartAdded] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string>("2:30 PM");
  const [voicePlaying, setVoicePlaying] = useState(false);

  const current = SITUATIONS[currentIndex];
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startAnimationCycle = useCallback(() => {
    setAnimStage(0);
    setCartAdded(false);
    setVoicePlaying(false);

    // Timeline for WhatsApp micro-interactions
    const t1 = setTimeout(() => setAnimStage(1), 500); // User message visible, typing indicator starts
    const t2 = setTimeout(() => setAnimStage(2), 1700); // Bot message pops in
    const t3 = setTimeout(() => setAnimStage(3), 2400); // Action card / rich widget slides in

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  // Handle auto-advance slider with smooth progress bar
  useEffect(() => {
    const cleanAnim = startAnimationCycle();

    if (isPaused) {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      return cleanAnim;
    }

    setProgress(0);
    const stepMs = 50;
    const increment = 100 / (SITUATION_DURATION / stepMs);

    progressIntervalRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          setCurrentIndex((old) => (old + 1) % SITUATIONS.length);
          return 0;
        }
        return prev + increment;
      });
    }, stepMs);

    return () => {
      cleanAnim();
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [currentIndex, isPaused, startAnimationCycle]);

  const selectSituation = (idx: number) => {
    setCurrentIndex(idx);
    setProgress(0);
  };

  return (
    <div
      className="relative max-w-[700px] mx-auto rounded-[28px] overflow-hidden border border-black/10 bg-[#efeae2]/90 shadow-[0_24px_70px_-20px_rgba(46,43,37,0.18)] backdrop-blur-xl text-left select-none transition-all"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      style={{
        backgroundImage: "radial-gradient(#d3cbbe 0.75px, transparent 0.75px)",
        backgroundSize: "16px 16px",
      }}
    >
      {/* WhatsApp Status Progress Bar (Auto-Slider Indicator) */}
      <div className="flex items-center gap-1.5 px-4 pt-3 pb-2 bg-neutral-900/90 text-white">
        {SITUATIONS.map((sit, i) => (
          <button
            key={sit.id}
            type="button"
            onClick={() => selectSituation(i)}
            className="flex-1 h-1.5 rounded-full overflow-hidden bg-white/20 transition-all hover:h-2 cursor-pointer relative"
            aria-label={`Jump to ${sit.tabLabel}`}
            title={sit.tabLabel}
          >
            <div
              className="h-full bg-emerald-400 transition-all duration-75 rounded-full"
              style={{
                width: i === currentIndex ? `${progress}%` : i < currentIndex ? "100%" : "0%",
              }}
            />
          </button>
        ))}
      </div>

      {/* WhatsApp App Header Bar */}
      <div className="flex items-center justify-between px-4 sm:px-5 py-3 bg-[#075e54] text-white shadow-xs">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="size-10 rounded-full bg-emerald-700/80 border border-emerald-400/30 flex items-center justify-center font-bold text-white text-sm shadow-xs">
              ✦
            </div>
            <span className="absolute bottom-0 right-0 size-3 rounded-full bg-emerald-400 border-2 border-[#075e54]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="font-semibold text-sm tracking-tight text-white leading-tight">Chatty Assistant</h4>
              <span className="size-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[9px] font-bold">✓</span>
            </div>
            <p className="text-[11px] text-emerald-100/90 flex items-center gap-1 mt-0.5">
              {animStage === 1 ? (
                <span className="text-emerald-200 font-medium animate-pulse">typing...</span>
              ) : current.type === "voice" ? (
                <span>online · LiveKit voice ready</span>
              ) : (
                <span>online · WhatsApp verified</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 text-emerald-100">
          {onOpenVoice && (
            <button
              type="button"
              onClick={onOpenVoice}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 border border-white/20 text-white text-xs font-semibold transition shadow-xs cursor-pointer"
              title="Launch LiveKit Voice Call"
            >
              <AudioWaveform className="size-3.5 text-emerald-300 animate-pulse" />
              <span className="hidden sm:inline">Voice Call</span>
            </button>
          )}
          <button type="button" className="p-1.5 hover:bg-white/10 rounded-full transition" aria-label="Video Call">
            <Video className="size-4" />
          </button>
          <button type="button" className="p-1.5 hover:bg-white/10 rounded-full transition" aria-label="Phone Call">
            <Phone className="size-4" />
          </button>
          <button type="button" className="p-1.5 hover:bg-white/10 rounded-full transition" aria-label="Menu">
            <MoreVertical className="size-4" />
          </button>
        </div>
      </div>

      {/* WhatsApp Message Body Container */}
      <div className="p-4 sm:p-6 space-y-4 min-h-[340px] flex flex-col justify-end">
        {/* Date Divider */}
        <div className="flex justify-center mb-1">
          <span className="px-3 py-0.5 rounded-md bg-white/70 backdrop-blur-xs text-[10px] font-medium text-neutral-600 shadow-2xs uppercase tracking-wider">
            Today · {current.tag}
          </span>
        </div>

        {/* 1. Visitor Message Bubble (Outgoing style on right) */}
        <div
          className={`flex justify-end transition-all duration-300 ${
            animStage >= 0 ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-3 scale-95"
          }`}
        >
          <div className="max-w-[85%] sm:max-w-[78%] rounded-2xl rounded-tr-xs p-3.5 bg-[#d9fdd3] text-neutral-900 shadow-sm border border-emerald-900/10 space-y-1.5">
            {current.isVoiceNoteUser ? (
              <div className="flex items-center gap-3 py-1">
                <button
                  type="button"
                  onClick={() => setVoicePlaying(!voicePlaying)}
                  className="size-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs hover:scale-105 transition"
                  aria-label="Play audio message"
                >
                  {voicePlaying ? <Pause className="size-4" /> : <Play className="size-4 ml-0.5" />}
                </button>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-1 h-5">
                    {[35, 60, 90, 45, 80, 100, 70, 50, 85, 40, 65, 30].map((h, i) => (
                      <span
                        key={i}
                        className={`w-1 rounded-full transition-all ${
                          voicePlaying ? "bg-emerald-600 animate-pulse" : "bg-emerald-700/60"
                        }`}
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between text-[10px] text-emerald-900/70">
                    <span>{current.userVoiceDuration}</span>
                    <span>Voice Note</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs sm:text-[13.5px] leading-relaxed font-normal">{current.userMessage}</p>
            )}
            <div className="flex items-center justify-end gap-1 text-[10px] text-emerald-900/60 pt-0.5">
              <span>{current.userTime}</span>
              <CheckCheck className="size-3.5 text-[#53bdeb]" />
            </div>
          </div>
        </div>

        {/* 2. WhatsApp Typing Indicator (during stage 1) */}
        {animStage === 1 && (
          <div className="flex items-start gap-2 animate-in fade-in zoom-in-95 duration-200">
            <div className="px-4 py-2.5 rounded-2xl rounded-tl-xs bg-white text-neutral-600 shadow-sm border border-black/5 flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="size-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="size-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}

        {/* 3. Chatty Response Bubble (Incoming style on left) */}
        {animStage >= 2 && (
          <div className="flex items-start gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="size-6 rounded-full bg-[#075e54] text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 shadow-xs">
              ✦
            </div>

            <div className="max-w-[90%] sm:max-w-[85%] space-y-2">
              <div className="rounded-2xl rounded-tl-xs p-3.5 bg-white text-neutral-900 shadow-sm border border-black/5 space-y-2">
                <p className="text-xs sm:text-[13.5px] leading-relaxed">{current.botMessage}</p>

                {/* Sub-widget: Situation 0 (Policy Verified Card) */}
                {current.type === "policy" && animStage >= 3 && (
                  <div className="pt-2 border-t border-neutral-100 animate-in fade-in zoom-in-95 duration-300 space-y-2">
                    <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-accent-700)] font-medium">
                      <BookOpen className="size-3.5 text-emerald-600" />
                      <span>Verified from Store Shipping &amp; Return Policy (Sec. 3.2)</span>
                    </div>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-xs font-semibold text-neutral-800 transition cursor-pointer"
                    >
                      <span>Request Return Label</span>
                      <ExternalLink className="size-3 text-neutral-500" />
                    </button>
                  </div>
                )}

                {/* Sub-widget: Situation 1 (E-Commerce Product Card) */}
                {current.type === "product" && animStage >= 3 && (
                  <div className="pt-2 border-t border-neutral-100 animate-in fade-in zoom-in-95 duration-300">
                    <div className="rounded-xl border border-black/8 bg-neutral-50/70 p-2.5 sm:p-3 flex items-center gap-3">
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
                        <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60">
                          In Stock · Mac &amp; Windows
                        </span>
                        <h5 className="text-xs font-bold text-neutral-900 truncate">Keychron K2 Pro Wireless RGB</h5>
                        <div className="flex items-center gap-1 text-[11px] text-amber-500 font-medium">
                          <Star className="size-3 fill-amber-400 text-amber-400" />
                          <span>4.9 (342 reviews)</span>
                        </div>
                        <div className="flex items-center justify-between pt-0.5">
                          <span className="font-bold text-xs text-neutral-900">$99.00 <span className="line-through text-neutral-400 text-[10px]">$119.00</span></span>
                          <button
                            type="button"
                            onClick={() => setCartAdded(true)}
                            className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#075e54] text-white hover:bg-emerald-800 transition shadow-2xs cursor-pointer flex items-center gap-1"
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

                {/* Sub-widget: Situation 2 (Voice Note with LiveKit Audio) */}
                {current.type === "voice" && animStage >= 3 && (
                  <div className="pt-2 border-t border-neutral-100 animate-in fade-in zoom-in-95 duration-300 space-y-2">
                    <div className="p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200/80 flex items-center justify-between gap-3 text-xs">
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
                        <span>Launch LiveKit Voice Call Now</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Sub-widget: Situation 3 (Calendar Booking Slots) */}
                {current.type === "calendar" && animStage >= 3 && (
                  <div className="pt-2 border-t border-neutral-100 animate-in fade-in zoom-in-95 duration-300 space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {["10:00 AM EST", "2:30 PM EST", "4:15 PM EST"].map((slot) => {
                        const isSelected = selectedSlot === slot;
                        return (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setSelectedSlot(slot)}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                              isSelected
                                ? "bg-[#075e54] text-white shadow-2xs"
                                : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                            }`}
                          >
                            {isSelected && <Check className="size-3" />}
                            <span>{slot}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-50 p-2 rounded-lg border border-emerald-200/60">
                      <Calendar className="size-3.5 text-emerald-600" />
                      <span>Google Meet invite ready for {selectedSlot}. Zoom link included.</span>
                    </div>
                  </div>
                )}

                <div className="flex justify-end text-[10px] text-neutral-400 pt-0.5">
                  <span>{current.botTime}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* WhatsApp Message Input Mockup Bar */}
      <div className="px-3 py-2 bg-[#f0f2f5] border-t border-black/5 flex items-center gap-2 text-neutral-500">
        <button type="button" className="p-1 hover:text-neutral-700 transition" aria-label="Emoji">
          <Smile className="size-5" />
        </button>
        <button type="button" className="p-1 hover:text-neutral-700 transition" aria-label="Attach File">
          <Paperclip className="size-5" />
        </button>
        <div className="flex-1 px-3.5 py-1.5 rounded-full bg-white border border-neutral-300/80 text-xs text-neutral-400 shadow-2xs">
          Type a message...
        </div>
        <button
          type="button"
          onClick={onOpenVoice}
          className="size-8 rounded-full bg-[#075e54] text-white flex items-center justify-center hover:bg-emerald-800 transition shadow-2xs cursor-pointer"
          aria-label="Send or Voice"
        >
          <AudioWaveform className="size-4 text-emerald-200" />
        </button>
      </div>

      {/* Situation Switcher Pills Below */}
      <div className="flex items-center justify-center gap-1.5 p-2 bg-neutral-100/90 border-t border-black/5 overflow-x-auto scrollbar-none">
        {SITUATIONS.map((sit, i) => {
          const isActive = i === currentIndex;
          return (
            <button
              key={sit.id}
              type="button"
              onClick={() => selectSituation(i)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                isActive
                  ? "bg-[#075e54] text-white shadow-2xs"
                  : "bg-white text-neutral-600 hover:text-neutral-900 border border-black/5"
              }`}
            >
              <span className={`size-1.5 rounded-full ${isActive ? "bg-emerald-300 animate-pulse" : "bg-neutral-400"}`} />
              <span>{sit.tabLabel}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
