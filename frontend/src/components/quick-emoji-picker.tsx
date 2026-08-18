"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search } from "lucide-react";

// A small hand-picked set grouped by category — no multi-hundred-KB dataset
// to parse on every open (that's what made the old emoji-mart picker feel
// slow). Frequency is tracked locally so "most used" rises to the top.
const CATEGORIES: { label: string; emojis: string[] }[] = [
  { label: "Frequently used", emojis: [] }, // filled in at runtime
  {
    label: "Smileys",
    emojis: ["😀","😂","🤣","😊","😍","😘","😉","😎","🤔","😅","😭","😢","😡","🥰","😴","🙄","😬","🤗","🥳","😇","🙃","😏","😴","🤩"],
  },
  {
    label: "Gestures",
    emojis: ["👍","👎","👏","🙌","🙏","👌","✌️","🤝","💪","👋","🤙","✋","🫶","👉","👈"],
  },
  {
    label: "Hearts",
    emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","💕","💖","💗","💔","❣️"],
  },
  {
    label: "Objects & symbols",
    emojis: ["🔥","✨","🎉","🎊","💯","⭐","✅","❌","⚠️","❓","❗","💬","💡","📌","🔔"],
  },
  {
    label: "Travel & activities",
    emojis: ["☀️","🌧️","🌈","⚡","🎈","🎁","☕","🍕","🍔","🎵","⚽","🏆","✈️","🚗","🏠"],
  },
];

const KEYWORDS: Record<string, string[]> = {
  "😀": ["smile", "happy", "grin"], "😂": ["laugh", "lol", "funny"], "🤣": ["laugh", "rofl"],
  "😊": ["smile", "happy", "blush"], "😍": ["love", "heart eyes"], "😘": ["kiss", "love"],
  "😉": ["wink"], "😎": ["cool", "sunglasses"], "🤔": ["think", "hmm"], "😅": ["sweat", "phew"],
  "😭": ["cry", "sob", "sad"], "😢": ["cry", "sad", "tear"], "😡": ["angry", "mad"],
  "🥰": ["love", "adore"], "😴": ["sleep", "tired"], "🙄": ["eyeroll", "annoyed"],
  "😬": ["awkward", "grimace"], "🤗": ["hug"], "🥳": ["party", "celebrate"], "😇": ["angel", "innocent"],
  "🙃": ["upside down", "silly"], "😏": ["smirk"], "🤩": ["starstruck", "excited"],
  "👍": ["thumbs up", "yes", "ok", "good"], "👎": ["thumbs down", "no", "bad"], "👏": ["clap", "applause"],
  "🙌": ["celebrate", "hooray"], "🙏": ["please", "thanks", "pray"], "👌": ["ok", "perfect"],
  "✌️": ["peace", "victory"], "🤝": ["handshake", "deal"], "💪": ["strong", "muscle"],
  "👋": ["wave", "hi", "bye", "hello"], "🤙": ["call", "hang loose"], "✋": ["stop", "hand"], "🫶": ["heart hands", "love"],
  "👉": ["point right"], "👈": ["point left"],
  "❤️": ["love", "heart", "red"], "🧡": ["heart", "orange"], "💛": ["heart", "yellow"],
  "💚": ["heart", "green"], "💙": ["heart", "blue"], "💜": ["heart", "purple"], "🖤": ["heart", "black"],
  "🤍": ["heart", "white"], "💕": ["love", "hearts"], "💖": ["sparkle heart"], "💗": ["heart growing"],
  "💔": ["broken heart", "sad"], "❣️": ["heart"],
  "🔥": ["fire", "lit", "hot"], "✨": ["sparkle", "shine"], "🎉": ["party", "celebrate", "congrats"],
  "🎊": ["confetti", "party"], "💯": ["hundred", "perfect"], "⭐": ["star"], "✅": ["check", "done", "yes"],
  "❌": ["cross", "no", "wrong"], "⚠️": ["warning"], "❓": ["question"], "❗": ["exclamation", "important"],
  "💬": ["chat", "message", "speech"], "💡": ["idea", "light bulb"], "📌": ["pin"], "🔔": ["bell", "notification"],
  "☀️": ["sun", "sunny"], "🌧️": ["rain"], "🌈": ["rainbow"], "⚡": ["lightning", "fast"],
  "🎈": ["balloon"], "🎁": ["gift", "present"], "☕": ["coffee"], "🍕": ["pizza"], "🍔": ["burger"],
  "🎵": ["music", "note"], "⚽": ["soccer", "football"], "🏆": ["trophy", "win"], "✈️": ["plane", "travel"],
  "🚗": ["car"], "🏠": ["home", "house"],
};

const STORAGE_KEY = "chatty_emoji_freq";
const MAX_FREQUENT = 16;

function loadFrequency(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function bumpFrequency(emoji: string) {
  try {
    const freq = loadFrequency();
    freq[emoji] = (freq[emoji] || 0) + 1;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(freq));
  } catch {}
}

interface QuickEmojiPickerProps {
  onSelect: (emoji: string) => void;
  accentColor?: string;
}

export function QuickEmojiPicker({ onSelect, accentColor = "#f97316" }: QuickEmojiPickerProps) {
  const [query, setQuery] = useState("");
  const [poppedEmoji, setPoppedEmoji] = useState<string | null>(null);
  const [frequent, setFrequent] = useState<string[]>([]);

  useEffect(() => {
    const freq = loadFrequency();
    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).map(([e]) => e);
    setFrequent(sorted.slice(0, MAX_FREQUENT));
  }, []);

  const groups = useMemo(() => {
    const base = CATEGORIES.map((c) => (c.label === "Frequently used" ? { ...c, emojis: frequent } : c));
    if (!query.trim()) return base.filter((g) => g.emojis.length > 0);
    const q = query.trim().toLowerCase();
    return base
      .map((g) => ({
        ...g,
        emojis: g.emojis.filter((e) => (KEYWORDS[e] || []).some((k) => k.includes(q))),
      }))
      .filter((g) => g.emojis.length > 0 && g.label !== "Frequently used");
  }, [query, frequent]);

  const pick = (emoji: string) => {
    bumpFrequency(emoji);
    setPoppedEmoji(emoji);
    onSelect(emoji);
    setTimeout(() => setPoppedEmoji((cur) => (cur === emoji ? null : cur)), 220);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 shrink-0">
        <div className="relative">
          <Search className="size-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search emoji…"
            className="w-full bg-neutral-100 dark:bg-neutral-800 rounded-lg pl-8 pr-2.5 py-1.5 text-[11px] focus:outline-none"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-3">
        {groups.length === 0 && (
          <p className="text-[11px] text-neutral-400 text-center pt-6">No emoji found</p>
        )}
        {groups.map((g) => (
          <div key={g.label}>
            <p className="text-[9px] font-bold uppercase tracking-wide text-neutral-400 mb-1.5">{g.label}</p>
            <div className="grid grid-cols-8 gap-0.5">
              {g.emojis.map((e, idx) => (
                <motion.button
                  key={`${g.label}-${e}-${idx}`}
                  type="button"
                  onClick={() => pick(e)}
                  whileHover={{ scale: 1.25, rotate: -6 }}
                  whileTap={{ scale: 0.85 }}
                  animate={poppedEmoji === e ? { scale: [1, 1.5, 0.9, 1.1, 1] } : { scale: 1 }}
                  transition={poppedEmoji === e
                    ? { duration: 0.45, times: [0, 0.3, 0.55, 0.75, 1], ease: "easeOut" }
                    : { type: "spring", stiffness: 500, damping: 15 }}
                  className="size-8 flex items-center justify-center text-lg rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  style={{ transformOrigin: "center" }}
                >
                  {e}
                </motion.button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="px-3 py-1.5 border-t border-neutral-100 dark:border-neutral-850 shrink-0" style={{ color: accentColor }}>
        <p className="text-[9px] text-neutral-400 text-center">Your most-used emoji show up first ✨</p>
      </div>
    </div>
  );
}
