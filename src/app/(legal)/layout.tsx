import Link from "next/link";
import Image from "next/image";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-full flex flex-col bg-white text-gray-800">
      <header className="border-b border-gray-100">
        <div className="mx-auto max-w-3xl px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/favicon.png" alt="Chatty" width={32} height={32} className="rounded-lg" />
            <span className="font-bold text-lg text-gray-900">Chatty</span>
          </Link>
          <nav className="flex items-center gap-5 text-sm text-gray-500">
            <Link href="/privacy" className="hover:text-orange-600">Privacy</Link>
            <Link href="/terms" className="hover:text-orange-600">Terms</Link>
            <Link href="/support" className="hover:text-orange-600">Support</Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-6 py-12 prose-gray">
          {children}
        </article>
      </main>

      <footer className="border-t border-gray-100">
        <div className="mx-auto max-w-3xl px-6 py-6 text-sm text-gray-400 flex flex-wrap items-center justify-between gap-2">
          <span>© {new Date().getFullYear()} PersonaliAI. All rights reserved.</span>
          <span>
            Chatty by{" "}
            <a href="https://personaliai.com" className="hover:text-orange-600">PersonaliAI</a>
          </span>
        </div>
      </footer>
    </div>
  );
}
