'use client'

import { useState, useEffect } from 'react'
import {
  CreditCard, TrendingUp, Download, AlertCircle, Check,
  X, Plus, Loader2, RefreshCw,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface BillingData {
  creditBalance: number
  execHoursUsed: number
  execHoursLimit: number
  plan: {
    name: string
    price: number
    features: string[]
  }
  transactions: Transaction[]
}

interface Transaction {
  id: string
  createdAt: string
  type: 'CREDIT' | 'DEBIT'
  amount: number
  description: string
  balanceAfter: number
}

// ─── Credit packages ──────────────────────────────────────────────────────────

const CREDIT_PACKAGES = [
  { credits: 1000,  price: 10,  label: '1,000 credits',  popular: false },
  { credits: 5000,  price: 45,  label: '5,000 credits',  popular: true  },
  { credits: 10000, price: 85,  label: '10,000 credits', popular: false },
]

const PLAN_FEATURES: Record<string, string[]> = {
  FREE:     ['5 exec hours/mo', '1 actor slot', '1K AI credits', '100 emails', 'Community support'],
  STARTER:  ['20 exec hours/mo', '5 actor slots', '10K AI credits', '500 emails', 'Proxy $8/GB', 'Community support'],
  GROW:     ['80 exec hours/mo', '15 actor slots', '30K AI credits', '2,500 emails', 'Proxy $7.5/GB', 'Priority support', 'CRM integrations'],
  SCALE:    ['300 exec hours/mo', '50 actor slots', '90K AI credits', '10K emails', 'Proxy $7/GB', 'Dedicated support', 'Advanced analytics'],
  ENTERPRISE: ['Unlimited exec hours', 'Unlimited slots', 'Custom AI credits', 'Unlimited emails', 'White-label', 'SLA guarantee'],
}

const PLAN_PRICES: Record<string, number> = {
  FREE: 0, STARTER: 49, GROW: 149, SCALE: 399, ENTERPRISE: 0,
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function AddCreditsModal({ onClose, onPurchased }: { onClose: () => void; onPurchased: () => void }) {
  const [selected, setSelected] = useState<number | null>(null)
  const [redirecting, setRedirecting] = useState(false)

  function purchase(credits: number) {
    setSelected(credits)
    setRedirecting(true)
    setTimeout(() => {
      setRedirecting(false)
      onClose()
    }, 2500)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#09090b] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Add Credits</h2>
          <button onClick={onClose} className="text-white/30 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        {redirecting ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <RefreshCw className="h-8 w-8 animate-spin text-violet-400" />
            <p className="text-sm text-white/60">Redirecting to Stripe…</p>
            <p className="text-xs text-white/30">{selected?.toLocaleString()} credits for ${CREDIT_PACKAGES.find(p => p.credits === selected)?.price}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {CREDIT_PACKAGES.map(pkg => (
              <button
                key={pkg.credits}
                onClick={() => purchase(pkg.credits)}
                className="w-full flex items-center justify-between p-4 rounded-xl border border-white/10 hover:border-violet-500/50 hover:bg-violet-500/5 transition-all"
              >
                <div className="text-left">
                  <p className="font-medium">{pkg.label}</p>
                  {pkg.popular && <span className="text-xs text-violet-400">Most popular</span>}
                </div>
                <span className="text-lg font-bold">${pkg.price}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const [data, setData] = useState<BillingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddCredits, setShowAddCredits] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  async function fetchBilling() {
    setLoading(true)
    try {
      const res = await fetch('/api/billing').then(r => r.json())
      setData(res)
    } catch {
      // Use fallback data
      setData({
        creditBalance: 18420,
        execHoursUsed: 23,
        execHoursLimit: 80,
        plan: { name: 'GROW', price: 149, features: PLAN_FEATURES['GROW'] ?? [] },
        transactions: [],
      })
    }
    setLoading(false)
  }

  useEffect(() => { fetchBilling() }, [])

  if (loading) {
    return <div className="flex-1 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-violet-400" /></div>
  }

  const billing = data!
  const planName = billing.plan?.name ?? 'GROW'
  const planFeatures = billing.plan?.features ?? PLAN_FEATURES[planName] ?? []
  const planPrice = billing.plan?.price ?? PLAN_PRICES[planName] ?? 149
  const execPct = billing.execHoursLimit > 0
    ? Math.min(100, Math.round((billing.execHoursUsed / billing.execHoursLimit) * 100))
    : 0

  const allPlans = ['STARTER', 'GROW', 'SCALE', 'ENTERPRISE']

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8 overflow-y-auto flex-1">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2 bg-violet-600 text-white text-sm rounded-xl shadow-xl">{toast}</div>
      )}
      {showAddCredits && (
        <AddCreditsModal onClose={() => setShowAddCredits(false)} onPurchased={fetchBilling} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Billing & Credits</h1>
          <p className="text-sm text-white/40 mt-0.5">Manage your plan, credits, and payment history</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 border border-white/10 rounded-lg text-sm hover:bg-white/5 transition-colors">
          <CreditCard className="h-4 w-4" />Update Payment Method
        </button>
      </div>

      {/* Credit balance + usage */}
      <div className="grid grid-cols-2 gap-5">
        {/* Balance */}
        <div className="border border-white/10 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-white/60 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-violet-400" />Credit Balance
            </h2>
            <button
              onClick={() => setShowAddCredits(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 rounded-lg text-xs transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />Add Credits
            </button>
          </div>
          <p className="text-4xl font-bold">{billing.creditBalance.toLocaleString()}</p>
          <p className="text-xs text-white/40">Available compute credits</p>
        </div>

        {/* Exec hours */}
        <div className="border border-white/10 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-medium text-white/60">Execution Hours</h2>
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-white/70">{billing.execHoursUsed}h used</span>
              <span className="text-white/40">{billing.execHoursLimit}h limit ({execPct}%)</span>
            </div>
            <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${execPct > 80 ? 'bg-red-500' : execPct > 60 ? 'bg-yellow-500' : 'bg-violet-500'}`}
                style={{ width: `${execPct}%` }}
              />
            </div>
          </div>
          {execPct > 70 && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <p className="text-xs text-amber-300">Approaching limit — consider upgrading.</p>
            </div>
          )}
        </div>
      </div>

      {/* Current plan */}
      <div className="border border-violet-500/30 bg-violet-500/5 rounded-xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-semibold">{planName} Plan</h2>
              <span className="text-xs px-2 py-0.5 bg-violet-600 text-white rounded-full">Current</span>
            </div>
            <p className="text-3xl font-bold mt-2">${planPrice}<span className="text-sm text-white/40 font-normal">/mo</span></p>
          </div>
          <ul className="space-y-1.5 text-sm">
            {planFeatures.map((f: string) => (
              <li key={f} className="flex items-center gap-2 text-white/70">
                <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />{f}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Upgrade options */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Available Plans</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {allPlans.map(plan => {
            const isCurrent = plan === planName
            const price = PLAN_PRICES[plan] ?? 0
            const features = PLAN_FEATURES[plan] ?? []
            return (
              <div key={plan} className={`border rounded-xl p-4 ${isCurrent ? 'border-violet-500/40 bg-violet-500/5' : 'border-white/10 hover:border-white/20'} transition-colors`}>
                <p className="font-semibold mb-1">{plan}</p>
                <p className="text-2xl font-bold mb-3">
                  {price === 0 ? (plan === 'ENTERPRISE' ? 'Custom' : 'Free') : `$${price}`}
                  {price > 0 && <span className="text-xs text-white/40 font-normal">/mo</span>}
                </p>
                <ul className="space-y-1 text-xs text-white/50 mb-4">
                  {features.slice(0, 3).map((f: string) => (
                    <li key={f} className="flex items-start gap-1.5"><Check className="h-3 w-3 text-emerald-400 shrink-0 mt-0.5" />{f}</li>
                  ))}
                </ul>
                {isCurrent ? (
                  <div className="w-full py-1.5 text-center text-xs text-white/30 border border-white/5 rounded-lg">Current</div>
                ) : plan === 'ENTERPRISE' ? (
                  <button
                    onClick={() => showToast('Contact sales@tudumm.com for Enterprise pricing.')}
                    className="w-full py-1.5 text-xs border border-white/10 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    Contact Sales
                  </button>
                ) : (
                  <button
                    onClick={() => showToast(`Upgrade to ${plan} coming soon — contact support.`)}
                    className="w-full py-1.5 text-xs bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors"
                  >
                    Upgrade
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Transactions */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Transaction History</h2>
        {(!billing.transactions || billing.transactions.length === 0) ? (
          <div className="text-center py-10 text-white/30 text-sm border border-white/10 rounded-xl">No transactions yet.</div>
        ) : (
          <div className="border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-white/40 text-xs">
                  <th className="text-left px-4 py-3 font-medium">Date</th>
                  <th className="text-left px-4 py-3 font-medium">Type</th>
                  <th className="text-left px-4 py-3 font-medium">Description</th>
                  <th className="text-right px-4 py-3 font-medium">Amount</th>
                  <th className="text-right px-4 py-3 font-medium">Balance</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {billing.transactions.map(tx => (
                  <tr key={tx.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                    <td className="px-4 py-3 text-white/50 text-xs">{new Date(tx.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${tx.type === 'CREDIT' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                        {tx.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/70">{tx.description}</td>
                    <td className={`px-4 py-3 text-right font-medium ${tx.type === 'CREDIT' ? 'text-green-400' : 'text-red-400'}`}>
                      {tx.type === 'CREDIT' ? '+' : '-'}{tx.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-white/50">{tx.balanceAfter.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => showToast('Invoice PDF coming soon.')}
                        className="flex items-center gap-1 text-xs text-white/30 hover:text-white transition-colors"
                      >
                        <Download className="h-3 w-3" />PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
