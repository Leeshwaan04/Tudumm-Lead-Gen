'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Zap, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await signIn('credentials', { email: email.trim(), password, redirect: false })
    setLoading(false)
    if (res?.error) {
      setError('Invalid email or password')
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">Tudumm</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Welcome back</h1>
          <p className="text-sm text-white/50 mt-1">Sign in to your workspace</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          <div>
            <label className="block text-xs text-white/40 mb-1.5">Email</label>
            <input
              type="email" required value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full px-3 py-2.5 text-sm bg-white/5 border border-white/10 rounded-lg outline-none focus:border-violet-500 text-white placeholder:text-white/20"
            />
          </div>
          <div>
            <label className="block text-xs text-white/40 mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2.5 pr-10 text-sm bg-white/5 border border-white/10 rounded-lg outline-none focus:border-violet-500 text-white placeholder:text-white/20"
              />
              <button type="button" onClick={() => setShowPw(p => !p)} className="absolute right-3 top-2.5 text-white/30 hover:text-white/60">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <button
            type="submit" disabled={loading}
            className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-sm text-white/40">
          No account?{' '}
          <Link href="/signup" className="text-violet-400 hover:text-violet-300">Create one free</Link>
        </p>
      </div>
    </div>
  )
}
