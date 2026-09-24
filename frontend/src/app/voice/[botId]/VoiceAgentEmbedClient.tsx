"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AudioWaveform, Phone, ShieldCheck } from "lucide-react";
import VoiceCallWidget from "@/components/voice-call-widget";
import { BACKEND_URL } from "@/lib/backend-client";

export default function VoiceAgentEmbedClient({
  botId,
  originToken,
}: {
  botId: string;
  originToken: string | null;
}) {
  const [active, setActive] = useState(true);
  const [callKey, setCallKey] = useState(0);
  const sessionId = useMemo(() => {
    const suffix = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
    return `voice-embed-${callKey}-${suffix}`;
  }, [callKey]);

  const primaryColor = "#c67139";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0b1118] text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute -left-32 -top-32 size-[32rem] rounded-full bg-orange-500/20 blur-3xl"
          animate={{ x: [0, 80, 0], y: [0, 50, 0], scale: [1, 1.12, 1] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-40 -right-24 size-[30rem] rounded-full bg-amber-300/10 blur-3xl"
          animate={{ x: [0, -70, 0], y: [0, -40, 0], scale: [1, 1.15, 1] }}
          transition={{ duration: 17, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,.5)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.5)_1px,transparent_1px)] [background-size:40px_40px]" />
      </div>

      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-5xl flex-col px-3 py-3 sm:px-8 sm:py-8">
        <header className="mb-3 flex items-center justify-between gap-3 sm:mb-8 sm:gap-4">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15 backdrop-blur">
              <AudioWaveform className="size-5 text-orange-300" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-wide text-white">Chatty Voice</p>
              <p className="text-[11px] text-white/50">Realtime AI conversation</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-white/60 sm:flex">
            <ShieldCheck className="size-3.5 text-emerald-300" />
            Private, encrypted session
          </div>
        </header>

        <section className="grid min-h-0 flex-1 items-stretch gap-4 lg:items-center lg:gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(420px,1.15fr)]">
          <div className="hidden px-2 lg:block">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-orange-300/80">Talk to your assistant</p>
            <h1 className="max-w-md text-4xl font-semibold leading-tight tracking-tight text-white xl:text-5xl">
              A natural conversation, in real time.
            </h1>
            <p className="mt-5 max-w-md text-sm leading-7 text-white/60">
              Speak normally. Chatty listens, responds, shows live transcription, and can help schedule your next meeting without leaving the call.
            </p>
            <div className="mt-7 flex flex-wrap gap-2 text-[11px] text-white/60">
              {["Live transcription", "Booking enabled", "No typing required"].map((item) => (
                <span key={item} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">{item}</span>
              ))}
            </div>
          </div>

          <div className="relative mx-auto flex h-[calc(100dvh-92px)] min-h-[500px] w-full max-w-[560px] flex-col overflow-hidden rounded-[24px] border border-white/15 bg-white/[0.97] shadow-[0_30px_100px_rgba(0,0,0,.5)] ring-1 ring-black/20 sm:h-[min(760px,calc(100dvh-112px))] sm:min-h-[600px] sm:rounded-[30px]">
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-black/10 bg-gradient-to-r from-[#b2622d] to-[#c67139] px-3 text-white sm:h-16 sm:px-5">
              <div className="flex items-center gap-3">
                <div className="grid size-8 place-items-center rounded-full bg-white text-[#b2622d] shadow-sm sm:size-9">
                  <AudioWaveform className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Chatty</p>
                  <p className="flex items-center gap-1 text-[10px] text-white/75"><span className="size-1.5 rounded-full bg-emerald-300" /> Voice agent online</p>
                </div>
              </div>
              <span className="rounded-full bg-white/15 px-2 py-1 text-[9px] font-semibold tracking-wide sm:px-2.5 sm:text-[10px]">LIVE CALL</span>
            </div>

            <div className="min-h-0 flex-1 bg-white text-neutral-900">
              <AnimatePresence mode="wait" initial={false}>
                {active ? (
                  <motion.div key={`active-${callKey}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                    <VoiceCallWidget
                      key={sessionId}
                      botId={botId}
                      sessionId={sessionId}
                      backendUrl={BACKEND_URL}
                      originToken={originToken}
                      visitorTimezone={typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC"}
                      primaryColor={primaryColor}
                      onClose={() => setActive(false)}
                    />
                  </motion.div>
                ) : (
                  <motion.div key="ready" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex h-full flex-col items-center justify-center px-8 text-center">
                    <div className="relative mb-6 grid size-28 place-items-center rounded-full bg-orange-100 text-[#c67139]">
                      <motion.div className="absolute inset-0 rounded-full border border-orange-300/70" animate={{ scale: [1, 1.28, 1], opacity: [0.7, 0, 0.7] }} transition={{ duration: 2.4, repeat: Infinity }} />
                      <AudioWaveform className="size-10" />
                    </div>
                    <h2 className="text-xl font-semibold text-neutral-900">Ready when you are</h2>
                    <p className="mt-2 max-w-xs text-sm leading-6 text-neutral-500">Start a private voice conversation with the Chatty assistant.</p>
                    <button type="button" onClick={() => { setCallKey((value) => value + 1); setActive(true); }} className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#c67139] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-900/20 transition-transform hover:scale-[1.02]">
                      <Phone className="size-4" /> Start voice call
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </section>

        <p className="pt-5 text-center text-[10px] text-white/35">Powered by Chatty · Your browser will ask for microphone permission when the call starts.</p>
      </div>
    </main>
  );
}
