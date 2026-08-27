"use client";

import { useEffect } from "react";

interface VerifyClientProps {
  token: string | null;
}

// Posts the origin-verification token back to widget.js exactly once, then
// renders nothing. This document is never shown — the hidden iframe that
// loads it exists solely so the browser attaches a real Referer header to
// its request (see page.tsx in this same folder).
export default function VerifyClient({ token }: VerifyClientProps) {
  useEffect(() => {
    try {
      window.parent?.postMessage({ type: "chatty-origin-token", token }, "*");
    } catch {}
  }, [token]);

  return null;
}
