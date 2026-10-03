import "@xyflow/react/dist/style.css";
import "./styles.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Chatty Flow Builder",
  description: "Build reliable automations for Chatty",
  icons: { icon: "/chatty_flow.png" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
