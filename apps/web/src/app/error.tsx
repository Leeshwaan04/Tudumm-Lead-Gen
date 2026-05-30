'use client'

import { useEffect } from 'react'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html>
      <body className="dark">
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 text-zinc-100 p-6">
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="text-sm text-zinc-400 max-w-md text-center">
            An unexpected error occurred. Our team has been notified.
            {error.digest && <span className="block mt-2 font-mono text-xs">Ref: {error.digest}</span>}
          </p>
          <button
            onClick={reset}
            className="mt-4 rounded bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
