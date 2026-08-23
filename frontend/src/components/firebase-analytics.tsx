"use client";

import { useEffect } from "react";
import { isSupported, getAnalytics } from "firebase/analytics";
import { firebaseApp } from "@/lib/firebase";

/**
 * Initializes Firebase Analytics once, client-side only. Rendered from the
 * root layout with no children/output — it exists purely for this side effect.
 *
 * getAnalytics() throws in environments it doesn't support (SSR — this module
 * only ever runs after mount anyway, but also some browsers with tracking
 * protection, or non-browser test/crawler contexts) — isSupported() is
 * Firebase's own recommended guard before calling it.
 */
export function FirebaseAnalytics() {
  useEffect(() => {
    let cancelled = false;
    isSupported()
      .then((supported) => {
        if (supported && !cancelled) {
          getAnalytics(firebaseApp);
        }
      })
      .catch(() => {
        // Analytics is a nice-to-have — never let its failure affect the app.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
