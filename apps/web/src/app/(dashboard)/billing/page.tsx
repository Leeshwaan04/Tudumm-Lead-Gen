'use client'

import { useQuery } from '@tanstack/react-query'
import { CreditCard, Check, Zap, Shield, Loader2, TrendingUp, Clock } from 'lucide-react'
import { useState } from 'react'

const PLANS = [
  {
    id: 'STARTER', name: 'Starter', price: 0, credits: 10000, execHours: 10,
    features: ['10,000 credits/month', '10 execution hours', '3 actor slots', 'Shared proxies', 'Email support'],
  },
  {
    id: 'GROW', name: 'Grow', price: 49, credits: 50000, execHours: 100, popular: true,
    features: ['50,000 credits/month', '100 execution hours', '20 actor slots', 'Custom proxies', 'Priority support', 'Webhook integrations'],
  },
  {
    id: 'SCALE', name: 'Scale', price: 199, credits: 500000, execHours: 0,
    features: ['500,000 credits/month', 'Unlimited execution', '100 actor slots', 'Dedicated IPs', 'Dedicated account manager', 'SLA 99.9%'],
  },
]

export default function BillingPage() {
  const [upgrading, setUpgrading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const { data: workspace, isLoading } = useQuery({ queryKey: ['workspace'], queryFn: () => fetch('/api/workspace').then(r => r.json()) })
  const { data: usage } = useQuery({ queryKey: ['usage'], queryFn: () => fetch('/api/usage').then(r => r.json()) })
  const { data: transactions } = useQuery({ queryKey: ['billing-tx'], queryFn: () => fetch('/api/billing/transactions').then(r => r.json()).catch(() => []) })

  function showToast(msg: string, ok: boolean) { setToast({ msg, ok }); setTimeout(() => setToast(null), 4000) }

  async function upgrade(planId: string) {
    setUpgrading(planId)
    try {
      const res = await fetch('/api/billing/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: planId }) })
      const data = await res.json()
      if (!res.ok) { showToast(data.error ?? 'Upgrade failed', false) }
      else if (data.checkout_url) { window.location.href = data.checkout_url }
      else { showToast('Upgrade initiated — check your email for confirmation.', true) }
    } catch { showToast('Network error. Please try again.', false) }
    setUpgrading(null)
  }

  const currentPlan = workspace?.plan ?? 'STARTER'
  const creditBalance = workspace?.creditBalance ?? 0
  const execHoursUsed = workspace?.execHoursUsed ?? 0
  const execHoursLimit = workspace?.execHoursLimit ?? 10
  const planDef = PLANS.find(p => p.id === currentPlan) ?? PLANS[0]!
  const creditPct = Math.min(Math.round(((planDef.credits - creditBalance) / planDef.credits) * 100), 100)
  const execPct = execHoursLimit > 0 ? Math.min(Math.round((execHoursUsed / execHoursLimit) * 100), 100) : 0

  if (isLoading) return <div className="flex-1 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-violet-400" /></div>

  return (
    <div className="flex h-full flex-col min-w-0 overflow-y-auto p-4 md:p-8">
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl border text-sm shadow-xl ${toast.ok ? 'bg-green-900/80 border-green-500/30 text-green-300' : 'bg-red-900/80 border-red-500/30 text-red-300'}`}>
          {toast.msg}
        </div>
      )}
      <div className="max-w-5xl mx-auto w-full space-y-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2"><CreditCard className="h-7 w-7 text-violet-400" /> Billing &amp; Usage</h1>
          <p className="text-white/50 mt-1 text-sm">Manage your subscription and track usage.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          <div className="md:col-span-2 bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div><p className="text-xs font-semibold text-white/40 uppercase tracking-wider">Current Plan</p><p className="text-2xl font-bold mt-1">{planDef.name}</p></div>
              <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs font-semibold rounded-full border border-green-500/20">Active</span>
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-white/60 flex items-center gap-1.5"><Zap className="h-3.5 w-3.5" />Credits remaining</span>
                  <span className="font-medium tabular-nums">{creditBalance.toLocaleString()} / {planDef.credits.toLocaleString()}</span>
                </div>
                <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${100 - creditPct}%` }} /></div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-white/60 flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />Execution hours</span>
                  <span className="font-medium tabular-nums">{execHoursUsed.toFixed(1)}h / {execHoursLimit}h</span>
                </div>
                <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${execPct}%` }} /></div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10">
              <div className="bg-white/5 rounded-xl p-3"><p className="text-xs text-white/40">Runs (30d)</p><p className="text-xl font-bold mt-0.5">{(usage?.summary?.totalRuns ?? 0).toLocaleString()}</p></div>
              <div className="bg-white/5 rounded-xl p-3"><p className="text-xs text-white/40">Credits used (30d)</p><p className="text-xl font-bold mt-0.5">{(usage?.summary?.totalCreditsUsed ?? 0).toLocaleString()}</p></div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-violet-600/20 to-indigo-600/20 border border-violet-500/30 rounded-2xl p-6 flex flex-col justify-center text-center">
            <Shield className="h-8 w-8 text-violet-400 mx-auto mb-3" />
            <h3 className="font-semibold mb-2">Need more power?</h3>
            <p className="text-xs text-white/60 mb-4 leading-relaxed">Upgrade for more credits, hours, and dedicated proxies.</p>
            <button onClick={() => document.getElementById('plans')?.scrollIntoView({ behavior: 'smooth' })} className="w-full py-2 bg-violet-600 hover:bg-violet-500 text-sm font-semibold rounded-lg transition-colors">View Plans</button>
          </div>
        </div>

        <div id="plans">
          <h2 className="text-xl font-bold mb-4">Available Plans</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {PLANS.map(plan => {
              const isCurrent = plan.id === currentPlan
              return (
                <div key={plan.id} className={`rounded-2xl p-6 flex flex-col relative bg-white/5 ${'popular' in plan && plan.popular ? 'border-2 border-violet-500 shadow-xl shadow-violet-500/10' : 'border border-white/10'}`}>
                  {'popular' in plan && plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="px-3 py-1 bg-violet-500 text-white text-xs font-bold uppercase tracking-wider rounded-full flex items-center gap-1"><Zap className="h-3 w-3" /> Most Popular</span>
                    </div>
                  )}
                  {isCurrent && <div className="absolute top-4 right-4"><span className="px-2 py-0.5 bg-white/10 text-xs rounded text-white/50">Current</span></div>}
                  <h3 className="text-lg font-bold mt-1">{plan.name}</h3>
                  <p className="text-3xl font-bold my-3">${plan.price}<span className="text-sm font-normal text-white/50">/mo</span></p>
                  <ul className="space-y-2.5 mb-6 flex-1">
                    {plan.features.map(f => <li key={f} className="flex gap-2 text-sm text-white/70"><Check className="h-4 w-4 text-violet-400 shrink-0 mt-0.5" />{f}</li>)}
                  </ul>
                  {isCurrent ? (
                    <button disabled className="w-full py-2 bg-white/10 text-white/40 rounded-lg text-sm font-medium cursor-not-allowed">Current Plan</button>
                  ) : (
                    <button onClick={() => upgrade(plan.id)} disabled={!!upgrading} className="w-full py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                      {upgrading === plan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
                      {upgrading === plan.id ? 'Processing…' : `Upgrade to ${plan.name}`}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {Array.isArray(transactions) && transactions.length > 0 && (
          <div>
            <h2 className="text-xl font-bold mb-4">Credit History</h2>
            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-white/10">
                  <tr>
                    <th className="text-left px-4 py-3 text-white/40 font-medium text-xs uppercase">Description</th>
                    <th className="text-right px-4 py-3 text-white/40 font-medium text-xs uppercase">Amount</th>
                    <th className="text-right px-4 py-3 text-white/40 font-medium text-xs uppercase hidden md:table-cell">Balance after</th>
                    <th className="text-right px-4 py-3 text-white/40 font-medium text-xs uppercase hidden md:table-cell">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.slice(0, 20).map((t: any) => (
                    <tr key={t.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                      <td className="px-4 py-3 text-white/80">{t.description}</td>
                      <td className={`px-4 py-3 text-right font-mono tabular-nums ${t.amount < 0 ? 'text-red-400' : 'text-green-400'}`}>{t.amount > 0 ? '+' : ''}{t.amount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-white/40 hidden md:table-cell tabular-nums">{t.balanceAfter?.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-white/40 hidden md:table-cell">{new Date(t.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
