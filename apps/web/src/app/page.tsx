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
    title: "Proxy Support",
    description:
      "Bring your own residential or datacenter proxies with built-in rotation, sticky sessions, and geo-routing for reliable scraping.",
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
    title: "Actor Store",
    description:
      "A growing library of ready-to-run actors — LinkedIn, Google Maps, Instagram, GitHub, email finder and more. One click to launch.",
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


const stats = [
  { label: "Scrape → enrich → outreach", value: "One pipeline" },
  { label: "AI lead scoring", value: "Built in" },
  { label: "Email finder + verifier", value: "Included" },
  { label: "Free to start", value: "$0" },
];

// Honest capability highlights (not fabricated testimonials).
const testimonials = [
  {
    quote:
      "Scrape LinkedIn, Google Maps, and the open web, then auto-enrich and score every lead against your ICP — in one visual workflow.",
    author: "Lead generation",
    role: "Scrape → Enrich → Qualify",
    company: "",
    avatar: "1",
  },
  {
    quote:
      "Find and verify business emails, enroll qualified leads into automated email sequences, and stop when they reply.",
    author: "Outreach",
    role: "Find emails → Sequence → Reply detection",
    company: "",
    avatar: "2",
  },
  {
    quote:
      "Build a pipeline once with the drag-and-drop builder, run it on a schedule, and export clean datasets or push to your tools via webhooks.",
    author: "Automation",
    role: "Build once → Run on schedule",
    company: "",
    avatar: "3",
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
            No-code lead generation & web automation
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
            <h2 className="text-3xl font-bold text-white">
              What you can build with Tudumm
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <Card key={t.author} className="border border-white/10 bg-white/5">
                <CardContent className="p-6">
                  <p className="text-slate-300 text-sm leading-relaxed mb-4">{t.quote}</p>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-xs font-bold">
                      {t.avatar}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">{t.author}</div>
                      <div className="text-xs text-slate-500">{t.role}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
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
              Scrape, enrich, and reach your leads — all in one platform. Free to start.
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
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
          </div>
          <div className="text-sm text-slate-600">© 2026 Tudumm, Inc.</div>
        </div>
      </footer>
    </div>
  );
}
