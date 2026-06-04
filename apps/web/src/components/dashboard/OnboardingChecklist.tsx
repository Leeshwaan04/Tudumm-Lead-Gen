'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Circle, X, ChevronRight, Zap } from 'lucide-react'

interface Workspace {
  creditBalance: number
  slots: number
  members: { user: { id: string } }[]
}

interface OnboardingChecklistProps {
  workspace: Workspace
  runs: any[]
  leads: any[]
  sequences: any[]
  linkedinSessions: any[]
}

const STORAGE_KEY = 'tudumm-onboarding-dismissed'

export default function OnboardingChecklist({
  workspace,
  runs,
  leads,
  sequences,
  linkedinSessions,
}: OnboardingChecklistProps) {
  const [dismissed, setDismissed] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setDismissed(localStorage.getItem(STORAGE_KEY) === 'true')
    setMounted(true)
  }, [])

  const steps = [
    {
      label: 'Workspace created',
      checked: true,
      href: null,
    },
    {
      label: 'Add your first lead',
      checked: leads.length > 0,
      href: '/leads',
    },
    {
      label: 'Connect LinkedIn session',
      checked: linkedinSessions.length > 0,
      href: '/linkedin',
    },
    {
      label: 'Create a sequence',
      checked: sequences.length > 0,
      href: '/sequences',
    },
    {
      label: 'Run your first actor',
      checked: runs.length > 0,
      href: '/store',
    },
  ]

  const completed = steps.filter((s) => s.checked).length
  const allComplete = completed === steps.length
  const progress = (completed / steps.length) * 100

  useEffect(() => {
    if (!allComplete) return
    const timer = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, 'true')
      setDismissed(true)
    }, 3000)
    return () => clearTimeout(timer)
  }, [allComplete])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, 'true')
    setDismissed(true)
  }

  if (!mounted || dismissed) return null

  return (
    <div className="rounded-xl border border-white/10 bg-[#121214] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-violet-400" />
          <span className="text-sm font-medium text-white">Getting Started</span>
        </div>
        <button
          onClick={dismiss}
          className="text-white/30 transition-colors hover:text-white/60"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {allComplete ? (
        <div className="mt-4 flex flex-col items-center gap-2 py-3 text-center">
          <span className="text-2xl">🎉</span>
          <p className="text-sm font-medium text-white">You're all set!</p>
          <p className="text-xs text-white/40">Dismissing in a moment…</p>
        </div>
      ) : (
        <>
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs text-white/40">{completed} of {steps.length} complete</span>
              <span className="text-xs text-violet-400 font-medium">{Math.round(progress)}%</span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-violet-500 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <ul className="mt-4 space-y-1">
            {steps.map((step) => {
              const inner = (
                <div
                  className={`flex items-center gap-3 rounded-lg px-2 py-2 transition-colors ${
                    step.href ? 'hover:bg-white/5 cursor-pointer' : ''
                  }`}
                >
                  {step.checked ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-violet-400" />
                  ) : (
                    <Circle className="h-4 w-4 shrink-0 text-white/20" />
                  )}
                  <span
                    className={`flex-1 text-sm ${
                      step.checked ? 'text-white/40 line-through' : 'text-white/80'
                    }`}
                  >
                    {step.label}
                  </span>
                  {!step.checked && step.href && (
                    <ChevronRight className="h-3.5 w-3.5 text-white/20" />
                  )}
                </div>
              )

              return (
                <li key={step.label}>
                  {step.href && !step.checked ? (
                    <Link href={step.href}>{inner}</Link>
                  ) : (
                    inner
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
