'use client'

import { useState, useRef, useEffect } from 'react'
import { HelpCircle } from 'lucide-react'

interface HelpTipProps {
  /** Short explainer — 1-2 sentences on what this does and when to use it. */
  text: string
  /** Optional concrete example. */
  example?: string
}

/** A small "?" that reveals a short explainer popover. Fills the "what is this?" gap inline. */
export function HelpTip({ text, example }: HelpTipProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="text-white/30 hover:text-violet-400 transition-colors"
        aria-label="What is this?"
      >
        <HelpCircle className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute left-1/2 top-full z-50 mt-2 w-64 -translate-x-1/2 rounded-xl border border-white/10 bg-slate-900 p-3 shadow-2xl">
          <p className="text-xs text-white/70 leading-relaxed">{text}</p>
          {example && (
            <p className="mt-1.5 text-[11px] text-white/40 leading-relaxed">
              <span className="text-white/60 font-medium">Example:</span> {example}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
