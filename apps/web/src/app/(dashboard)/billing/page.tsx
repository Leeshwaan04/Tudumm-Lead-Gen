"use client";

import { CreditCard, Check, Zap, ArrowRight, Shield } from "lucide-react";

export default function BillingPage() {
  return (
    <div className="flex h-full flex-col min-w-0 overflow-y-auto p-8">
      <div className="max-w-5xl mx-auto w-full space-y-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <CreditCard className="h-8 w-8 text-violet-400" />
            Billing & Usage
          </h1>
          <p className="text-white/50 mt-2">Manage your subscription, view your usage, and update payment methods.</p>
        </div>

        {/* Current Plan Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider">Current Plan</h3>
                <p className="text-2xl font-bold mt-1">Starter</p>
              </div>
              <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs font-semibold rounded-full">
                Active
              </span>
            </div>
            
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-white/60">Credits Used</span>
                  <span className="font-medium">150 / 500</span>
                </div>
                <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-violet-500 w-[30%]" />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-white/60">Execution Hours</span>
                  <span className="font-medium">2.4h / 10h</span>
                </div>
                <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 w-[24%]" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-violet-600/20 to-indigo-600/20 border border-violet-500/30 rounded-2xl p-6 flex flex-col justify-center text-center">
            <Shield className="h-8 w-8 text-violet-400 mx-auto mb-3" />
            <h3 className="font-semibold mb-2">Upgrade for more power</h3>
            <p className="text-sm text-white/60 mb-4">Get unlimited credits, custom proxy support, and priority execution.</p>
            <button className="w-full py-2 bg-violet-600 hover:bg-violet-500 text-sm font-semibold rounded-lg transition-colors">
              View Plans
            </button>
          </div>
        </div>

        {/* Upgrade Plans */}
        <div className="mt-12">
          <h2 className="text-xl font-bold mb-6">Available Plans</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Starter Plan */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col relative opacity-50">
              <div className="absolute top-0 right-0 p-4">
                <span className="px-2 py-1 bg-white/10 text-xs font-medium rounded">Current</span>
              </div>
              <h3 className="text-lg font-bold">Starter</h3>
              <p className="text-3xl font-bold my-4">$0 <span className="text-sm font-normal text-white/50">/mo</span></p>
              <ul className="space-y-3 mb-8 flex-1">
                <li className="flex gap-2 text-sm text-white/70"><Check className="h-4 w-4 text-violet-400 shrink-0" /> 500 Credits / month</li>
                <li className="flex gap-2 text-sm text-white/70"><Check className="h-4 w-4 text-violet-400 shrink-0" /> 10 Execution Hours</li>
                <li className="flex gap-2 text-sm text-white/70"><Check className="h-4 w-4 text-violet-400 shrink-0" /> Shared Proxies</li>
              </ul>
              <button disabled className="w-full py-2 bg-white/10 text-white/50 rounded-lg text-sm font-medium">
                Current Plan
              </button>
            </div>

            {/* Grow Plan */}
            <div className="bg-white/5 border-2 border-violet-500 rounded-2xl p-6 flex flex-col relative shadow-xl shadow-violet-500/10">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="px-3 py-1 bg-violet-500 text-white text-xs font-bold uppercase tracking-wider rounded-full flex items-center gap-1">
                  <Zap className="h-3 w-3" /> Most Popular
                </span>
              </div>
              <h3 className="text-lg font-bold mt-2">Grow</h3>
              <p className="text-3xl font-bold my-4">$49 <span className="text-sm font-normal text-white/50">/mo</span></p>
              <ul className="space-y-3 mb-8 flex-1">
                <li className="flex gap-2 text-sm text-white/70"><Check className="h-4 w-4 text-violet-400 shrink-0" /> 5,000 Credits / month</li>
                <li className="flex gap-2 text-sm text-white/70"><Check className="h-4 w-4 text-violet-400 shrink-0" /> 100 Execution Hours</li>
                <li className="flex gap-2 text-sm text-white/70"><Check className="h-4 w-4 text-violet-400 shrink-0" /> Custom Proxies</li>
                <li className="flex gap-2 text-sm text-white/70"><Check className="h-4 w-4 text-violet-400 shrink-0" /> Priority Support</li>
              </ul>
              <button className="w-full py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm font-medium transition-colors">
                Upgrade to Grow
              </button>
            </div>

            {/* Scale Plan */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col">
              <h3 className="text-lg font-bold">Scale</h3>
              <p className="text-3xl font-bold my-4">$199 <span className="text-sm font-normal text-white/50">/mo</span></p>
              <ul className="space-y-3 mb-8 flex-1">
                <li className="flex gap-2 text-sm text-white/70"><Check className="h-4 w-4 text-violet-400 shrink-0" /> 50,000 Credits / month</li>
                <li className="flex gap-2 text-sm text-white/70"><Check className="h-4 w-4 text-violet-400 shrink-0" /> Unlimited Execution</li>
                <li className="flex gap-2 text-sm text-white/70"><Check className="h-4 w-4 text-violet-400 shrink-0" /> Dedicated Account Manager</li>
                <li className="flex gap-2 text-sm text-white/70"><Check className="h-4 w-4 text-violet-400 shrink-0" /> Dedicated IPs</li>
              </ul>
              <button className="w-full py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors">
                Upgrade to Scale
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
