import React from "react";

export function AgentImgIcon({
  name,
  className = "size-4",
  alt,
}: {
  name: string;
  className?: string;
  alt?: string;
}) {
  return (
    <img
      src={`/agents/${name}.png`}
      alt={alt || `${name} logo`}
      className={`${className} object-contain rounded-[4px] shrink-0`}
      width={24}
      height={24}
      loading="eager"
    />
  );
}

export function TerminalIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="3" width="20" height="18" rx="3" stroke="currentColor" strokeWidth="2" />
      <path d="M6 8L10 12L6 16M12 16H18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
