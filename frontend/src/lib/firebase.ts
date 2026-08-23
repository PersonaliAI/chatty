// Firebase app init — analytics only, for now. All values below are the public
// web app config Firebase issues for client-side use (not secrets; they identify
// the project, they don't authenticate as it — access is enforced by Firebase
// Security Rules and API key restrictions in the console, same as any Firebase
// web app). Still sourced from env vars rather than hardcoded, so this file is
// safe to keep in git and the actual project identifiers stay out of source.
import { initializeApp, getApps, type FirebaseOptions } from "firebase/app";

export const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// getApps() guard: Next.js can re-evaluate this module (Fast Refresh, multiple
// client components importing it) — initializeApp() throws if called twice
// for the same app.
export const firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
