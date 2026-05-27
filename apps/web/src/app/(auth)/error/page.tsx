'use client'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Zap, AlertCircle } from 'lucide-react'
import { Suspense } from 'react'

function ErrorContent() {
  const params = useSearchParams()
  const msg = params.get('msg') ?? params.get('error') ?? 'An authentication error occurred.'

  const friendly: Record<string, string> = {
    OAuthAccountNotLinked: 'This email is already linked to a different sign-in method. Please use email/password to log in.',
    'Failed to get user info from GitHub': 'GitHub sign-in is not configured yet. Please use email and password to log in.',
    CredentialsSignin: 'Invalid email or password.',
  }

  const display = Object.entries(friendly).find(([k]) => msg.includes(k))?.[1] ?? msg

  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <span className="text-2xl font-bold text-white">Tudumm</span>
        </div>

        <div className="flex flex-col items-center gap-3 p-5 rounded-xl bg-red-500/10 border border-red-500/20">
          <AlertCircle className="h-8 w-8 text-red-400" />
          <p className="text-sm text-red-300">{display}</p>
        </div>

        <Link
          href="/login"
          className="block w-full py-2.5 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm font-medium text-white transition-colors"
        >
          Back to login
        </Link>
      </div>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense>
      <ErrorContent />
    </Suspense>
  )
}
