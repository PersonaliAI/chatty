"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function SuccessPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-sm space-y-4">
        <div className="size-12 mx-auto rounded-full bg-emerald-50 grid place-items-center text-emerald-600">
          <CheckCircle2 className="size-6" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">You're all set</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your subscription is active. Head back to your dashboard to keep going.
          </p>
        </div>
        <Link
          href="/dashboard"
          className={buttonVariants({ className: "w-full h-10 font-medium" })}
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
