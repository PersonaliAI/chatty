import React from "react";

export function PageTitle({ children, updated }: { children: React.ReactNode; updated?: string }) {
  return (
    <header className="mb-8">
      <h1 className="text-3xl font-bold text-gray-900">{children}</h1>
      {updated && <p className="mt-2 text-sm text-gray-400">Last updated: {updated}</p>}
    </header>
  );
}

export function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-10 mb-3 text-xl font-semibold text-gray-900">{children}</h2>;
}

export function P({ children }: { children: React.ReactNode }) {
  return <p className="mb-4 leading-relaxed text-gray-600">{children}</p>;
}

export function UL({ children }: { children: React.ReactNode }) {
  return <ul className="mb-4 list-disc space-y-2 pl-6 text-gray-600">{children}</ul>;
}

export function Mail({ user = "support" }: { user?: string }) {
  return (
    <a href={`mailto:${user}@personaliai.com`} className="text-orange-600 hover:underline">
      {user}@personaliai.com
    </a>
  );
}
