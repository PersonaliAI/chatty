"use client";

import { motion } from "framer-motion";
import { Image as ImageIcon, FileText, MapPin } from "lucide-react";

interface AttachMenuProps {
  onPickImages: () => void;
  onPickDocuments: () => void;
  onShareLocation: () => void;
  accentColor?: string;
}

const ITEMS = (accentColor: string) => [
  { key: "images", label: "Photos & videos", icon: ImageIcon, bg: `${accentColor}1a`, fg: accentColor },
  { key: "documents", label: "Documents", icon: FileText, bg: "#3b82f61a", fg: "#3b82f6" },
  { key: "location", label: "Location", icon: MapPin, bg: "#22c55e1a", fg: "#22c55e" },
];

const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10, scale: 0.7 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, stiffness: 420, damping: 16 } },
};

export function AttachMenu({ onPickImages, onPickDocuments, onShareLocation, accentColor = "#f97316" }: AttachMenuProps) {
  const items = ITEMS(accentColor);
  const handlers: Record<string, () => void> = {
    images: onPickImages,
    documents: onPickDocuments,
    location: onShareLocation,
  };

  return (
    <motion.div variants={listVariants} initial="hidden" animate="show" className="flex flex-col gap-1 p-1.5">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <motion.button
            key={item.key}
            type="button"
            variants={itemVariants}
            whileHover={{ scale: 1.03, x: 2 }}
            whileTap={{ scale: 0.95 }}
            onClick={handlers[item.key]}
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 text-left"
          >
            <span className="size-8 rounded-full flex items-center justify-center shrink-0" style={{ background: item.bg, color: item.fg }}>
              <Icon className="size-4" />
            </span>
            <span className="text-xs font-semibold">{item.label}</span>
          </motion.button>
        );
      })}
    </motion.div>
  );
}
