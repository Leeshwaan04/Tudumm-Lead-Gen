'use client'

import { useEffect } from 'react'

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex h-full flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-red-900/10 via-black to-black min-w-0 p-6">
      <div className="flex flex-col items-center justify-center max-w-sm text-center p-8 rounded-3xl bg-white/[0.02] border border-red-500/10 shadow-2xl backdrop-blur-xl">
        <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center mb-6 ring-1 ring-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.15)]">
          <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">Something went wrong</h2>
        <p className="text-sm text-red-400/80 mb-6 leading-relaxed bg-red-500/5 p-3 rounded-lg border border-red-500/10">
          {error.message || 'An unexpected error occurred while loading this page.'}
        </p>
        <button 
          onClick={reset} 
          className="flex items-center justify-center w-full px-5 py-2.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-xl text-sm font-medium transition-all hover:scale-105 active:scale-95"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
