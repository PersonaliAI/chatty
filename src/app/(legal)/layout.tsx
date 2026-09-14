import Link from "next/link";
import Image from "next/image";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-white text-zinc-900 font-sans antialiased">
      <header className="sticky top-0 z-50 border-b border-zinc-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto max-w-4xl px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/favicon.png" alt="Chatty Logo" width={28} height={28} className="object-contain" priority />
            <span className="font-display font-bold text-lg text-zinc-950">Chatty</span>
          </Link>
          <nav className="flex items-center gap-6 text-xs font-semibold text-zinc-600">
            <Link href="/" className="hover:text-zinc-950 transition-colors">Home</Link>
            <Link href="/privacy" className="hover:text-[#f95721] transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-[#f95721] transition-colors">Terms</Link>
            <Link href="/support" className="hover:text-[#f95721] transition-colors">Support</Link>
            <Link
              href="/signup"
              className="rounded-xl bg-[#f95721] hover:bg-[#ea4815] text-white px-3.5 py-1.5 transition-all shadow-sm shadow-orange-500/20"
            >
              Start free
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 py-12">
        <article className="mx-auto max-w-4xl px-6 prose prose-zinc prose-headings:font-display">
          {children}
        </article>
      </main>

      <footer className="border-t border-zinc-200 bg-zinc-50 py-8 text-xs text-zinc-500">
        <div className="mx-auto max-w-4xl px-6 flex flex-wrap items-center justify-between gap-4">
          <span>© {new Date().getFullYear()} PersonaliAI. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-zinc-900">Chatty Home</Link>
            <Link href="/privacy" className="hover:text-zinc-900">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-zinc-900">Terms of Service</Link>
            <Link href="/support" className="hover:text-zinc-900">Support</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
