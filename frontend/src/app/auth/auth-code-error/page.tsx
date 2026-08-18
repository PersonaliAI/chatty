import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background relative overflow-hidden">
      {/* Background dot grid pattern */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-50" 
           style={{ 
             backgroundImage: 'radial-gradient(circle, #d4d4d4 1px, transparent 1px)', 
             backgroundSize: '24px 24px' 
           }}>
      </div>

      <div className="w-full max-w-sm z-10 text-center">
        <div className="size-16 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-6 text-red-600">
          <AlertCircle className="size-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight mb-2">Authentication Failed</h1>
        <p className="text-sm text-muted-foreground mb-8">
          The login code was invalid or expired. This usually happens if you wait too long to sign in or if your environment variables are mismatched.
        </p>
        <div className="space-y-4 flex flex-col">
          <Link href="/login" className={cn(buttonVariants({ variant: "default" }), "w-full h-10 font-medium")}>
            Try again
          </Link>
          <Link href="/" className={cn(buttonVariants({ variant: "outline" }), "w-full h-10 font-medium")}>
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
