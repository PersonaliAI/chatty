import { Suspense } from "react";
import type { Metadata } from "next";
import ClaimClient from "./ClaimClient";

export const metadata: Metadata = {
  title: "AI Support Assistant Preview | Chatty",
  description: "Test your pre-trained AI customer support assistant and claim it for your website.",
};

export default async function ClaimPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-slate-500 font-medium text-sm">
          <div className="size-4 rounded-full border-2 border-slate-300 border-t-slate-800 animate-spin" />
          Loading preview...
        </div>
      </div>
    }>
      <ClaimClient token={token} />
    </Suspense>
  );
}
