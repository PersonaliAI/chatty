'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-4 text-center text-neutral-950 antialiased dark:bg-neutral-950 dark:text-neutral-50">
        <h1 className="text-lg font-medium">Something went wrong</h1>
        <p className="max-w-md text-sm text-neutral-500 dark:text-neutral-400">
          An unexpected error occurred. You can try again, or reload the page if the problem
          persists.
        </p>
        <button
          onClick={() => reset()}
          className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-neutral-950 px-2.5 text-sm font-medium text-white transition-all hover:bg-neutral-950/80 dark:bg-neutral-50 dark:text-neutral-950 dark:hover:bg-neutral-50/80"
        >
          Try again
        </button>
      </body>
    </html>
  )
}
