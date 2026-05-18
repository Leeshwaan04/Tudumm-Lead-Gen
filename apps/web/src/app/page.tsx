import React from "react";
import Link from "next/link";
import {
  Zap,
  Ghost,
  GitBranch,
  Globe2,
  Database,
  Shield,
  ArrowRight,
  CheckCircle2,
  Star,
  Users,
  TrendingUp,
  Play,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: Ghost,
    title: "Phantom Library",
    description:
      "500+ pre-built automation agents for LinkedIn, Instagram, Google Maps, and more. Launch in seconds, no coding required.",
    color: "text-violet-400",
    bg: "bg-violet-500/10 border-violet-500/20",
  },
  {
    icon: GitBranch,
    title: "Visual Workflow Builder",
    description:
      "Drag-and-drop DAG builder to chain actors into complex multi-step pipelines. Conditional branches, error handling, retry logic.",
    color: "text-indigo-400",
    bg: "bg-indigo-500/10 border-indigo-500/20",
  },
  {
    icon: Globe2,
    title: "Enterprise Proxy Network",
    description:
      "72M+ residential IPs across 195 countries. Rotating, sticky, mobile, and datacenter proxies with 99.9% uptime SLA.",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
  },
  {
    icon: Database,
    title: "Structured Datasets",
    description:
      "Every run outputs clean, schema-validated datasets. Export to CSV, JSON, or stream to your data warehouse via webhooks.",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10 border-cyan-500/20",
  },
  {
    icon: Zap,
    title: "27K+ Actor Store",
    description:
      "The world's largest marketplace of web automation actors. Community-built, professionally reviewed, instantly deployable.",
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
  },
  {
    icon: Shield,
    title: "Anti-Detection Layer",
    description:
      "Built-in browser fingerprinting, CAPTCHA solving, rate limiting, and human-like behavior simulation to bypass blocks.",
    color: "text-pink-400",
    bg: "bg-pink-500/10 border-pink-500/20",
  },
];

const plans = [
  {
    name: "Starter",
    price: 49,
    credits: "10,000",
    features: [
      "10,000 credits/month",
      "50 concurrent actors",
      "Residential proxies",
      "5 scheduled runs",
      "CSV exports",
      "Email support",
    ],
    cta: "Start free trial",
    popular: false,
  },
  {
    name: "Growth",
    price: 149,
    credits: "50,000",
    features: [
      "50,000 credits/month",
      "200 concurrent actors",
      "All proxy types",
      "Unlimited schedules",
      "All export formats",
      "Workflow builder",
      "Priority support",
      "Webhook integrations",
    ],
    cta: "Get started",
    popular: true,
  },
  {
    name: "Scale",
    price: 499,
    credits: "250,000",
    features: [
      "250,000 credits/month",
      "Unlimited actors",
      "Dedicated proxy pool",
      "Unlimited everything",
      "SSO / SAML",
      "Custom actor SLAs",
      "Dedicated CSM",
      "SLA 99.9%",
    ],
    cta: "Talk to sales",
    popular: false,
  },
];

const stats = [
  { label: "Actors available", value: "27,000+" },
  { label: "Proxy IPs", value: "72M+" },
  { label: "Monthly runs", value: "180M+" },
  { label: "Data points extracted", value: "2.4B+" },
];

const testimonials = [
  {
    quote:
      "Tudumm replaced three separate tools — PhantomBuster, BrightData, and a custom scraper. Our lead volume tripled in 60 days.",
    author: "Sarah Chen",
    role: "Head of Growth",
    company: "Accel-backed SaaS",
    avatar: "SC",
  },
  {
    quote:
      "The workflow builder is genuinely magical. We built a 12-step LinkedIn outreach pipeline in an afternoon. Zero engineering time.",
    author: "Marcus Reid",
    role: "Revenue Operations",
    company: "Series B Fintech",
    avatar: "MR",
  },
  {
    quote:
      "27K actors is not a typo. Whatever data source we need, there's already a battle-tested actor for it. Game changer.",
    author: "Priya Sharma",
    role: "Data Engineer",
    company: "Enterprise SaaS",
    avatar: "PS",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg shadow-violet-500/25">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-xl text-white tracking-tight">Tudumm</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm text-slate-400">
            <Link href="#features" className="hover:text-white transition-colors">Features</Link>
            <Link href="#pricing" className="hover:text-white transition-colors">Pricing</Link>
            <Link href="/store" className="hover:text-white transition-colors">Store</Link>
            <Link href="#" className="hover:text-white transition-colors">Docs</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">Log in</Button>
            </Link>
            <Link href="/signup">
              <Button variant="gradient" size="sm">
                Start free <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden pt-24 pb-20 px-6">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-to-b from-violet-600/20 to-transparent rounded-full blur-3xl" />
          <div className="absolute top-32 left-1/4 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-5xl text-center">
          <Badge variant="purple" className="mb-6 text-sm px-4 py-1.5 rounded-full border border-violet-500/40">
            <Star className="h-3.5 w-3.5 mr-1.5 text-amber-400 fill-amber-400" />
            Rated #1 web automation platform — Product Hunt
          </Badge>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold leading-[1.08] tracking-tight mb-6">
            <span className="text-white">Web automation</span>
            <br />
            <span className="gradient-text">without limits</span>
          </h1>

          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            The unified platform for web scraping, automation, proxy infrastructure, and lead intelligence.
            Think PhantomBuster + BrightData + Apify — in one place, at half the cost.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link href="/signup">
              <Button variant="gradient" size="xl" className="glow-violet px-10">
                Start for free
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="outline" size="xl" className="border-white/20 hover:border-white/40">
                <Play className="h-4 w-4" />
                View demo
              </Button>
            </Link>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-white/10 bg-white/5 p-4 text-center backdrop-blur-sm"
              >
                <div className="text-2xl font-bold text-white">{s.value}</div>
                <div className="text-xs text-slate-400 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              Everything you need to automate the web
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              Six powerful modules. One unified platform. From first scrape to enterprise-grade pipeline.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <Card
                  key={f.title}
                  className={`border ${f.bg} group hover:scale-[1.02] transition-all duration-200 cursor-pointer`}
                >
                  <CardContent className="p-6">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl border mb-4 ${f.bg}`}>
                      <Icon className={`h-6 w-6 ${f.color}`} />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">{f.title}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">{f.description}</p>
                    <div className="mt-4 flex items-center gap-1 text-xs font-medium text-violet-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      Learn more <ChevronRight className="h-3.5 w-3.5" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Social proof */}
      <section className="py-24 px-6 border-y border-white/5 bg-white/[0.02]">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-2 mb-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-5 w-5 text-amber-400 fill-amber-400" />
              ))}
            </div>
            <h2 className="text-3xl font-bold text-white">
              Loved by 12,000+ growth teams
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <Card key={t.author} className="border border-white/10 bg-white/5">
                <CardContent className="p-6">
                  <div className="flex items-center gap-1 mb-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                    ))}
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed mb-4">&ldquo;{t.quote}&rdquo;</p>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-xs font-bold">
                      {t.avatar}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">{t.author}</div>
                      <div className="text-xs text-slate-500">{t.role} · {t.company}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-6">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Simple, predictable pricing</h2>
            <p className="text-slate-400 text-lg">All plans include a 14-day free trial. No credit card required.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl border p-8 ${
                  plan.popular
                    ? "border-violet-500/50 bg-gradient-to-b from-violet-900/30 to-slate-900/50 shadow-2xl shadow-violet-500/20 scale-[1.02]"
                    : "border-white/10 bg-white/5"
                }`}
              >
                {plan.popular && (
                  <Badge variant="purple" className="mb-4 text-xs">Most popular</Badge>
                )}
                <div className="mb-6">
                  <div className="text-sm font-semibold text-slate-400 mb-1">{plan.name}</div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-white">${plan.price}</span>
                    <span className="text-slate-400 text-sm">/month</span>
                  </div>
                  <div className="text-sm text-violet-400 mt-1">{plan.credits} credits included</div>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/signup">
                  <Button
                    variant={plan.popular ? "gradient" : "outline"}
                    size="lg"
                    className={`w-full ${!plan.popular && "border-white/20"}`}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-900/30 to-indigo-900/20 p-16">
            <Users className="h-12 w-12 text-violet-400 mx-auto mb-6" />
            <h2 className="text-4xl font-bold text-white mb-4">
              Ready to automate everything?
            </h2>
            <p className="text-slate-400 text-lg mb-8">
              Join 12,000+ companies extracting intelligence from the web at scale.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/signup">
                <Button variant="gradient" size="xl">
                  <TrendingUp className="h-5 w-5" />
                  Start extracting data
                </Button>
              </Link>
              <Link href="#" className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-1">
                Schedule a demo <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 px-6">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-gradient-to-br from-violet-600 to-indigo-600">
              <Zap className="h-3 w-3 text-white" />
            </div>
            <span className="font-bold text-white">Tudumm</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <Link href="#" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="#" className="hover:text-white transition-colors">Terms</Link>
            <Link href="#" className="hover:text-white transition-colors">Status</Link>
            <Link href="#" className="hover:text-white transition-colors">Docs</Link>
          </div>
          <div className="text-sm text-slate-600">© 2026 Tudumm, Inc.</div>
        </div>
      </footer>
    </div>
  );
}
