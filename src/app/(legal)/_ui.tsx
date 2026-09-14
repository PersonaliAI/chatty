import React from "react";

export function PageTitle({ children, updated }: { children: React.ReactNode; updated?: string }) {
  return (
    <header className="mb-10 pb-6 border-b border-zinc-200">
      <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-950">{children}</h1>
      {updated && <p className="mt-2 text-xs font-mono text-zinc-500">Last updated: {updated}</p>}
    </header>
  );
}

export function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-10 mb-4 font-display text-xl font-bold tracking-tight text-zinc-900">{children}</h2>;
}

export function P({ children }: { children: React.ReactNode }) {
  return <p className="mb-4 leading-relaxed text-sm text-zinc-600">{children}</p>;
}

export function UL({ children }: { children: React.ReactNode }) {
  return <ul className="mb-4 list-disc space-y-2 pl-6 text-sm text-zinc-600">{children}</ul>;
}

export function Mail({ user = "support" }: { user?: string }) {
  return (
    <a href={`mailto:${user}@personaliai.com`} className="font-medium text-[#f95721] hover:underline">
      {user}@personaliai.com
    </a>
  );
}
