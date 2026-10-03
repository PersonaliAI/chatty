import "./styles.css";
import type { ReactNode } from "react";

export const metadata = { title: "Chatty Flow Builder", description: "Build reliable automations for Chatty" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
