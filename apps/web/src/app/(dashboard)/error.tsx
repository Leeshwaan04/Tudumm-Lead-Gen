'use client'

import { useEffect } from 'react'

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-12">
      <h2 className="text-lg font-semibold">Failed to load this page</h2>
      <p className="text-sm text-zinc-400">{error.message || 'An unexpected error occurred.'}</p>
      <button onClick={reset} className="rounded bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500">
        Retry
      </button>
    </div>
  )
}
