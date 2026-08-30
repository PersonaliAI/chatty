"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Upload, Loader2, Check, ArrowRight, ArrowLeft, X, Wand2, MessageSquare,
} from "lucide-react";
import { getOnColor } from "@/lib/color-contrast";

interface InitialBot {
  name: string;
  primaryColor: string;
  widgetStyle: string;
  welcomeMessage: string;
  systemInstructions: string;
  logoUrl: string | null;
}

interface Props {
  botId: string;
  initial: InitialBot;
  fetchBackend: (path: string, opts?: RequestInit) => Promise<Response>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  onComplete: (f: InitialBot) => void;
  onClose: () => void;
}

const STYLES = [
  { id: "minimal", name: "Minimal", desc: "Clean SaaS, off-white" },
  { id: "playful", name: "Playful", desc: "Rounded & warm" },
  { id: "corporate", name: "Corporate", desc: "Structured navy" },
  { id: "dark-sleek", name: "Dark Sleek", desc: "Near-black with glow" },
  { id: "gradient-glow", name: "Gradient Glow", desc: "Vivid gradient" },
  { id: "glassmorphism", name: "Glassmorphism", desc: "Frosted glass" },
  { id: "ecommerce", name: "E-commerce", desc: "Order-aware shop" },
  { id: "healthcare-calm", name: "Healthcare Calm", desc: "Soft sage & serif" },
  { id: "neubrutalism", name: "Neubrutalism", desc: "Bold, thick borders" },
  { id: "luxury-editorial", name: "Luxury Editorial", desc: "Serif & gold" },
];

export function OnboardingWizard({ botId, initial, fetchBackend, supabase, onComplete, onClose }: Props) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initial.name);
  const [primaryColor, setPrimaryColor] = useState(initial.primaryColor);
  const [widgetStyle, setWidgetStyle] = useState(initial.widgetStyle);
  const [welcomeMessage, setWelcomeMessage] = useState(initial.welcomeMessage);
  const [systemInstructions, setSystemInstructions] = useState(initial.systemInstructions);
  const [logoUrl, setLogoUrl] = useState<string | null>(initial.logoUrl);

  const [hint, setHint] = useState("");
  const [generating, setGenerating] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const steps = ["Identity", "Business", "Style", "Finish"];

  const uploadLogo = async (file: File) => {
    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append("bot_id", botId);
      fd.append("file", file);
      const res = await fetchBackend("/api/bot/logo", { method: "POST", body: fd });
      if (res.ok) {
        const d = await res.json();
        setLogoUrl(d.logo_url);
      }
    } catch (e) {
      console.error("logo upload failed", e);
    } finally {
      setUploadingLogo(false);
    }
  };

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await fetchBackend("/api/generate-business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: botId, hint }),
      });
      if (res.ok) {
        const d = await res.json();
        if (d.system_instructions) setSystemInstructions(d.system_instructions);
        if (d.welcome_message) setWelcomeMessage(d.welcome_message);
      }
    } catch (e) {
      console.error("generate failed", e);
    } finally {
      setGenerating(false);
    }
  };

  const finish = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("chatty_bots").update({
        name, primary_color: primaryColor, widget_style: widgetStyle,
        welcome_message: welcomeMessage, system_instructions: systemInstructions,
        logo_url: logoUrl,
        // "logo" without a logoUrl falls back to the selected design's own
        // dot mark (see widget.js's buildChatIcon) — a generic bot glyph
        // isn't the design's actual default, so never force it here.
        avatar_icon: "logo",
        onboarding_completed: true, onboarding_step: 9,
        updated_at: new Date().toISOString(),
      }).eq("id", botId);
      if (error) throw error;
      onComplete({ name, primaryColor, widgetStyle, welcomeMessage, systemInstructions, logoUrl });
      onClose();
    } catch (e) {
      console.error("finish failed", e);
    } finally {
      setSaving(false);
    }
  };

  // The X button and step-0's "Skip" both used to call the raw onClose prop
  // directly — pure local state, no persistence — so the wizard reappeared
  // on every single page load/refresh forever, since onboarding_completed
  // never actually got set unless the visitor finished all 4 steps via
  // finish() above. This marks it done (without touching name/color/etc.,
  // since nothing was actually configured on an early exit) before closing.
  const dismiss = async () => {
    try {
      await supabase.from("chatty_bots").update({
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      }).eq("id", botId);
    } catch (e) {
      console.error("dismiss failed", e);
    } finally {
      onClose();
    }
  };

  const next = () => setStep((s) => Math.min(s + 1, steps.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-100 dark:border-neutral-850 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Sparkles className="size-4" style={{ color: primaryColor }} /> Set up your AI Assistant
            </h3>
            <p className="text-[10px] text-neutral-400 mt-0.5">Step {step + 1} of {steps.length} · {steps[step]}</p>
          </div>
          <button onClick={dismiss} className="text-neutral-400 hover:text-neutral-600 cursor-pointer"><X className="size-4" /></button>
        </div>

        {/* Progress */}
        <div className="flex gap-1 px-6 pt-3">
          {steps.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? "" : "bg-neutral-200 dark:bg-neutral-800"}`} style={i <= step ? { background: primaryColor } : {}} />
          ))}
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.18 }}>
              {/* STEP 1: Identity */}
              {step === 0 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 mb-1.5">Agent logo</label>
                    <div className="flex items-center gap-4">
                      <div className="size-16 rounded-2xl border-2 border-dashed border-neutral-200 dark:border-neutral-800 flex items-center justify-center overflow-hidden bg-neutral-50 dark:bg-neutral-950">
                        {logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- uploaded-file URL, not in next/image's domain allowlist
                          <img src={logoUrl} alt="logo" className="size-full object-cover" />
                        ) : (
                          <Upload className="size-5 text-neutral-400" />
                        )}
                      </div>
                      <div>
                        <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); }} />
                        <button onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo} className="px-3 py-1.5 text-xs font-semibold rounded-lg text-white cursor-pointer flex items-center gap-1.5" style={{ background: primaryColor }}>
                          {uploadingLogo ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />} Upload image
                        </button>
                        <p className="text-[10px] text-neutral-400 mt-1">PNG/JPG, max 10MB</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 mb-1.5">Agent name</label>
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Acme Support" className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 mb-1.5">Brand color</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="size-9 rounded-lg border border-neutral-200 dark:border-neutral-800 cursor-pointer bg-transparent" />
                      <input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-28 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none" />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: Business + Generate with AI */}
              {step === 1 && (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl border border-dashed" style={{ borderColor: primaryColor + "66", background: primaryColor + "0d" }}>
                    <label className="block text-[11px] font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: primaryColor }}><Wand2 className="size-3.5" /> Describe your business — let AI write the rest</label>
                    <div className="flex gap-2">
                      <input value={hint} onChange={(e) => setHint(e.target.value)} placeholder="e.g. Acme sells organic cotton t-shirts in Paris" className="flex-1 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none" />
                      <button onClick={generate} disabled={generating || !hint.trim()} className="px-3 py-2 text-xs font-semibold rounded-lg text-white cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shrink-0" style={{ background: primaryColor }}>
                        {generating ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />} Generate
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 mb-1.5">Assistant instructions</label>
                    <textarea value={systemInstructions} onChange={(e) => setSystemInstructions(e.target.value)} rows={5} placeholder="How should the assistant behave? What should it help with?" className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none resize-y leading-relaxed" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 mb-1.5">Welcome message</label>
                    <input value={welcomeMessage} onChange={(e) => setWelcomeMessage(e.target.value)} className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none" />
                  </div>
                </div>
              )}

              {/* STEP 3: Style */}
              {step === 2 && (
                <div className="space-y-4">
                  <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-300">Widget style</label>
                  <div className="grid grid-cols-2 gap-3">
                    {STYLES.map((s) => (
                      <button key={s.id} onClick={() => setWidgetStyle(s.id)} className={`p-3 text-left border rounded-xl transition-all cursor-pointer ${widgetStyle === s.id ? "" : "border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/30"}`} style={widgetStyle === s.id ? { borderColor: primaryColor, background: primaryColor + "0d" } : {}}>
                        <div className="text-xs font-bold">{s.name}</div>
                        <p className="text-[9px] text-neutral-400 mt-1">{s.desc}</p>
                      </button>
                    ))}
                  </div>
                  {/* Live preview — reflects the actual per-style CSS (globals.css
                      .style-* rules) so switching styles here shows the same
                      look the embedded widget will actually have. */}
                  <div
                    className={`mt-2 rounded-2xl overflow-hidden style-${widgetStyle}`}
                    style={{ ["--primary-color" as string]: primaryColor, ["--on-primary" as string]: getOnColor(primaryColor) }}
                  >
                    <div className="chat-header p-3 flex items-center gap-2" style={{ background: primaryColor }}>
                      <div
                        className="size-7 rounded-full flex items-center justify-center overflow-hidden font-bold text-xs"
                        style={{ backgroundColor: `color-mix(in srgb, ${getOnColor(primaryColor)} 25%, transparent)`, color: getOnColor(primaryColor) }}
                      >
                        {logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- uploaded-file URL, not in next/image's domain allowlist
                          <img src={logoUrl} alt="" className="size-full object-cover" />
                        ) : (
                          name[0]?.toUpperCase() || "C"
                        )}
                      </div>
                      <div className="text-xs font-semibold" style={{ color: getOnColor(primaryColor) }}>{name || "Your Assistant"}</div>
                    </div>
                    <div className="p-3 bg-white dark:bg-neutral-900">
                      <div className="bot-bubble inline-block bg-neutral-100 dark:bg-neutral-800 rounded-2xl rounded-tl-none px-3 py-2 text-xs">{welcomeMessage || "Hello! How can I help you today?"}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: Finish */}
              {step === 3 && (
                <div className="text-center py-6">
                  <div className="size-14 rounded-2xl mx-auto flex items-center justify-center" style={{ background: primaryColor + "1a" }}>
                    <Check className="size-7" style={{ color: primaryColor }} />
                  </div>
                  <h4 className="text-sm font-bold mt-4">You&apos;re all set, {name || "there"}!</h4>
                  <p className="text-xs text-neutral-500 mt-1.5 max-w-sm mx-auto leading-relaxed">
                    Your assistant is configured. Next, add knowledge in the Knowledge Base, then embed it on your website from Embed &amp; Integrate.
                  </p>
                  <div className="flex items-center justify-center gap-2 mt-4 text-[11px] text-neutral-400">
                    <MessageSquare className="size-3.5" /> Tip: train it with your FAQs for sharper answers
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-100 dark:border-neutral-850 flex items-center justify-between">
          <button onClick={step === 0 ? dismiss : back} className="px-3 py-2 text-xs font-semibold text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 cursor-pointer flex items-center gap-1.5">
            {step === 0 ? "Skip" : <><ArrowLeft className="size-3.5" /> Back</>}
          </button>
          {step < steps.length - 1 ? (
            <button onClick={next} className="px-4 py-2 text-xs font-semibold rounded-lg text-white cursor-pointer flex items-center gap-1.5" style={{ background: primaryColor }}>
              Continue <ArrowRight className="size-3.5" />
            </button>
          ) : (
            <button onClick={finish} disabled={saving} className="px-4 py-2 text-xs font-semibold rounded-lg text-white cursor-pointer flex items-center gap-1.5 disabled:opacity-50" style={{ background: primaryColor }}>
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Finish setup
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
