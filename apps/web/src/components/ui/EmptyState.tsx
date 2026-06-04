'use client'

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  /** One-line "what is this" */
  title: string
  /** The outcome — why a user would use it */
  what: string
  /** A concrete example to make it tangible */
  example?: string
  ctaLabel: string
  ctaHref?: string
  onCta?: () => void
  secondaryLabel?: string
  onSecondary?: () => void
}

/**
 * Teaching empty state: answers what / why / do-this-first so a DIY user
 * understands a feature instead of staring at a blank page.
 */
export function EmptyState({
  icon: Icon, title, what, example, ctaLabel, ctaHref, onCta, secondaryLabel, onSecondary,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center border border-white/10 rounded-2xl gap-4 max-w-xl mx-auto">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10">
        <Icon className="h-7 w-7 text-violet-400" />
      </div>
      <div className="space-y-1.5">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        <p className="text-sm text-white/50 leading-relaxed">{what}</p>
        {example && (
          <p className="text-xs text-white/35 leading-relaxed">
            <span className="text-white/50 font-medium">Example:</span> {example}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 mt-1">
        {ctaHref ? (
          <Link href={ctaHref} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm font-medium transition-colors">
            {ctaLabel}
          </Link>
        ) : (
          <button onClick={onCta} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm font-medium transition-colors">
            {ctaLabel}
          </button>
        )}
        {secondaryLabel && (
          <button onClick={onSecondary} className="px-4 py-2 border border-white/10 hover:bg-white/5 rounded-lg text-sm transition-colors">
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  )
}
