"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Filter, SlidersHorizontal, X, Play, Zap, Clock,
  RefreshCw, ChevronDown, CheckSquare, Square, PackageOpen,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Phantom {
  id: string;        // real DB actor id — passed directly to /api/runs/enqueue
  slug: string;      // actor slug — used for platform/input detection
  name: string;
  platform: string;  // derived from slug / category
  category: string;
  description: string;
  icon: string;
  unitsPerRun: number;   // mapped from price
  averageDuration: number; // not in API — default 120
  totalLaunches: number;   // mapped from runs
  rating: number;
  outputFields: string[];
  isPopular: boolean;
  tags: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Derive a rough platform label from slug / category for badge colour. */
function derivePlatform(slug: string, category: string): string {
  if (slug.includes("linkedin")) return "linkedin";
  if (slug.includes("instagram")) return "instagram";
  if (slug.includes("twitter")) return "twitter";
  if (slug.includes("google")) return "google";
  if (slug.includes("github")) return "github";
  if (slug.includes("youtube")) return "youtube";
  return category.toLowerCase();
}

/** Emoji icon from slug/category. */
function deriveIcon(slug: string, category: string): string {
  if (slug.includes("linkedin")) return "💼";
  if (slug.includes("instagram")) return "📸";
  if (slug.includes("twitter")) return "🐦";
  if (slug.includes("google")) return "🗺️";
  if (slug.includes("github")) return "🐙";
  if (slug.includes("youtube")) return "▶️";
  if (slug.includes("email")) return "✉️";
  if (slug.includes("apollo")) return "🚀";
  if (slug.includes("web")) return "🌐";
  if (category === "Enrichment") return "🔬";
  if (category === "Developer") return "💻";
  return "⚡";
}

/** Build tags from slug words. */
function deriveTags(slug: string): string[] {
  return slug.split("-").filter(w => w.length > 2).slice(0, 3);
}

/** Parse a JSON-string-or-array field from the DB actor row. */
function parseJsonArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string") { try { const p = JSON.parse(v); return Array.isArray(p) ? p.map(String) : []; } catch { return []; } }
  return [];
}

/** Map a real DB actor row (/api/actors?store=true) → Phantom shape. */
function mapActor(a: {
  id: string;
  slug: string;
  name: string;
  description: string;
  categories?: unknown;
  tags?: unknown;
  rating?: number;
  totalRuns?: number;
}): Phantom {
  const cats = parseJsonArray(a.categories);
  const tags = parseJsonArray(a.tags);
  const category = cats[0] ?? "General";
  const platform = derivePlatform(a.slug, category);
  const runs = a.totalRuns ?? 0;
  return {
    id: a.id,
    slug: a.slug,
    name: a.name,
    platform,
    category,
    description: a.description,
    icon: deriveIcon(a.slug, category),
    unitsPerRun: 1,
    averageDuration: 120,
    totalLaunches: runs,
    rating: a.rating ?? 4.5,
    outputFields: [],
    isPopular: runs > 100000,
    tags: tags.length ? tags.slice(0, 3) : deriveTags(a.slug),
  };
}

function formatN(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return String(n);
}

const platformColors: Record<string, string> = {
  linkedin: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  instagram: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  twitter: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  google: "bg-red-500/10 text-red-400 border-red-500/20",
  github: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  youtube: "bg-red-500/10 text-red-400 border-red-500/20",
};

// ─── Toast ────────────────────────────────────────────────────────────────────

function useToast() {
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }
  return { toast, showToast };
}

function ToastBanner({ toast }: { toast: { msg: string; type: "success" | "error" } | null }) {
  if (!toast) return null;
  const base = "fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-xl text-sm font-medium shadow-xl border transition-all";
  const style = toast.type === "error"
    ? "bg-red-900/90 border-red-500/30 text-red-200"
    : "bg-emerald-900/90 border-emerald-500/30 text-emerald-200";
  return <div className={`${base} ${style}`}>{toast.msg}</div>;
}

// ─── Launch Modal ─────────────────────────────────────────────────────────────

function LaunchModal({
  phantom,
  onClose,
  showToast,
}: {
  phantom: Phantom;
  onClose: () => void;
  showToast: (msg: string, type?: "success" | "error") => void;
}) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [launching, setLaunching] = useState(false);
  const [done, setDone] = useState(false);

  const slug = phantom.slug.toLowerCase();
  const isLinkedIn = phantom.platform === "linkedin";
  const isGoogle = phantom.platform === "google" || slug.includes("google-maps");
  const isEmailFinder = slug.includes("email");
  const isApollo = slug.includes("apollo");
  const isSocial = ["twitter", "github", "instagram"].includes(phantom.platform);

  // Extra fields for Email Finder
  const [efDomain, setEfDomain] = useState("");
  const [efFirst, setEfFirst] = useState("");
  const [efLast, setEfLast] = useState("");

  async function launch() {
    setLaunching(true);
    let inputObj: Record<string, unknown> = {};
    if (isLinkedIn) {
      inputObj = { url: input, maxResults: 100 };
    } else if (isGoogle) {
      inputObj = { query: input };
    } else if (isEmailFinder) {
      inputObj = { domain: efDomain.trim(), firstName: efFirst.trim(), lastName: efLast.trim() };
    } else if (isApollo) {
      inputObj = { domain: input.trim() };
    } else if (isSocial) {
      inputObj = { url: input.trim() };
    } else {
      try { inputObj = JSON.parse(input || "{}"); } catch { inputObj = { query: input }; }
    }
    try {
      // phantom.id is the real DB actor id — enqueue accepts it directly.
      const res = await fetch("/api/runs/enqueue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorId: phantom.id, input: inputObj }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? `Server error ${res.status}`);
      }

      setDone(true);
      showToast("Launch queued! Redirecting…", "success");
      setTimeout(() => { onClose(); router.push("/actors"); }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to launch phantom.";
      showToast(msg, "error");
      setLaunching(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#09090b] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{phantom.icon}</span>
            <div>
              <h2 className="text-base font-semibold">{phantom.name}</h2>
              <p className="text-xs text-white/40 flex items-center gap-1">
                <Zap className="h-3 w-3 text-amber-400" />{phantom.unitsPerRun} runs/unit
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        {done ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <div className="h-12 w-12 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center">
              <Play className="h-5 w-5 text-green-400" />
            </div>
            <p className="text-sm font-medium text-green-400">Launch queued!</p>
            <p className="text-xs text-white/40">Redirecting to Runs monitor…</p>
          </div>
        ) : (
          <>
            <div>
              {isLinkedIn ? (
                <>
                  <label className="text-xs text-white/50 mb-1 block">LinkedIn Search URL or Profile URL</label>
                  <input value={input} onChange={e => setInput(e.target.value)}
                    placeholder="https://www.linkedin.com/search/results/people/..."
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/50" />
                  <p className="text-xs text-white/30 mt-1.5">Requires an active LinkedIn session in Settings → LinkedIn.</p>
                </>
              ) : isGoogle ? (
                <>
                  <label className="text-xs text-white/50 mb-1 block">Search Query</label>
                  <input value={input} onChange={e => setInput(e.target.value)}
                    placeholder="coffee shops in New York"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/50" />
                </>
              ) : isEmailFinder ? (
                <>
                  <label className="text-xs text-white/50 mb-1 block">Company Domain</label>
                  <input value={efDomain} onChange={e => setEfDomain(e.target.value)}
                    placeholder="acme.com"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/50 mb-2" />
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-xs text-white/50 mb-1 block">First Name</label>
                      <input value={efFirst} onChange={e => setEfFirst(e.target.value)}
                        placeholder="John"
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/50" />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-white/50 mb-1 block">Last Name</label>
                      <input value={efLast} onChange={e => setEfLast(e.target.value)}
                        placeholder="Smith"
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/50" />
                    </div>
                  </div>
                  <p className="text-xs text-white/30 mt-1.5">Requires HUNTER_API_KEY or APOLLO_API_KEY set in env.</p>
                </>
              ) : isApollo ? (
                <>
                  <label className="text-xs text-white/50 mb-1 block">Company Domain to enrich leads from</label>
                  <input value={input} onChange={e => setInput(e.target.value)}
                    placeholder="acme.com"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/50" />
                  <p className="text-xs text-white/30 mt-1.5">Requires APOLLO_API_KEY set in env.</p>
                </>
              ) : isSocial ? (
                <>
                  <label className="text-xs text-white/50 mb-1 block">
                    {phantom.platform === "twitter" ? "Twitter/X Profile or Search URL" :
                     phantom.platform === "github" ? "GitHub User, Org, or Search URL" :
                     "Instagram Profile URL"}
                  </label>
                  <input value={input} onChange={e => setInput(e.target.value)}
                    placeholder={
                      phantom.platform === "twitter" ? "https://twitter.com/search?q=saas+founder" :
                      phantom.platform === "github" ? "https://github.com/search?q=python&type=users" :
                      "https://www.instagram.com/explore/tags/startup/"
                    }
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/50" />
                  {(phantom.platform === "twitter" || phantom.platform === "instagram") && (
                    <p className="text-xs text-white/30 mt-1.5">
                      Requires a connected session in Settings → Social Accounts.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <label className="text-xs text-white/50 mb-1 block">Input JSON or URL</label>
                  <textarea value={input} onChange={e => setInput(e.target.value)} rows={4}
                    placeholder='{"url": "https://example.com"}'
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-mono text-white placeholder:text-white/20 resize-none focus:outline-none focus:border-violet-500/50" />
                </>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 text-sm border border-white/10 rounded-lg hover:bg-white/5 transition-colors">Cancel</button>
              <button
                onClick={launch}
                disabled={launching}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-lg transition-colors"
              >
                {launching ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                Launch Now
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Filter Dropdown ──────────────────────────────────────────────────────────

function FilterDropdown({ label, icon: Icon, options, selected, onChange }: {
  label: string;
  icon: React.ElementType;
  options: string[];
  selected: Set<string>;
  onChange: (s: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  function toggle(v: string) {
    const next = new Set(selected);
    next.has(v) ? next.delete(v) : next.add(v);
    onChange(next);
  }
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-colors ${selected.size > 0 ? 'border-violet-500/50 text-violet-300 bg-violet-500/10' : 'border-white/10 text-white/60 hover:border-white/20 bg-white/5'}`}
      >
        <Icon className="h-4 w-4" />{label}
        {selected.size > 0 && <span className="text-xs bg-violet-600 text-white rounded-full px-1.5">{selected.size}</span>}
        <ChevronDown className="h-3.5 w-3.5 opacity-50" />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 z-20 bg-[#0d0d14] border border-white/10 rounded-xl shadow-xl p-2 min-w-[160px]">
          {options.map(opt => (
            <button
              key={opt}
              onClick={() => toggle(opt)}
              className="flex items-center gap-2.5 w-full px-2.5 py-2 text-sm rounded-lg hover:bg-white/5 transition-colors"
            >
              {selected.has(opt) ? <CheckSquare className="h-4 w-4 text-violet-400" /> : <Square className="h-4 w-4 text-white/20" />}
              {opt}
            </button>
          ))}
          <button onClick={() => setOpen(false)} className="w-full mt-1 py-1 text-xs text-white/30 hover:text-white transition-colors border-t border-white/5">Close</button>
        </div>
      )}
    </div>
  );
}

// ─── Phantom Card ─────────────────────────────────────────────────────────────

function PhantomCardItem({ phantom, onLaunch }: { phantom: Phantom; onLaunch: () => void }) {
  const platColor = platformColors[phantom.platform] ?? "bg-white/5 text-white/50 border-white/10";
  return (
    <div className="group border border-white/10 hover:border-violet-500/30 rounded-xl p-5 space-y-4 transition-all hover:shadow-lg hover:shadow-violet-500/10 flex flex-col">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 text-xl shrink-0">
          {phantom.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm leading-tight group-hover:text-violet-300 transition-colors">{phantom.name}</h3>
            {phantom.isPopular && <span className="text-xs px-1.5 py-0.5 bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded-full">Popular</span>}
          </div>
          <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full border mt-1 ${platColor}`}>{phantom.platform}</span>
        </div>
      </div>

      <p className="text-xs text-white/50 leading-relaxed flex-1">{phantom.description}</p>

      <div className="flex flex-wrap gap-1">
        {phantom.tags.slice(0, 3).map(t => (
          <span key={t} className="text-xs text-white/30 bg-white/5 rounded px-1.5 py-0.5">{t}</span>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs text-center">
        <div className="rounded-lg bg-white/5 p-2">
          <div className="flex items-center justify-center gap-1 text-amber-400 font-semibold"><Zap className="h-3 w-3" />{phantom.unitsPerRun}</div>
          <div className="text-white/30 mt-0.5">runs/unit</div>
        </div>
        <div className="rounded-lg bg-white/5 p-2">
          <div className="flex items-center justify-center gap-1 text-yellow-400 font-semibold">★ {phantom.rating.toFixed(1)}</div>
          <div className="text-white/30 mt-0.5">rating</div>
        </div>
        <div className="rounded-lg bg-white/5 p-2">
          <div className="flex items-center justify-center gap-1 text-emerald-400 font-semibold"><Play className="h-3 w-3" />{formatN(phantom.totalLaunches)}</div>
          <div className="text-white/30 mt-0.5">launches</div>
        </div>
      </div>

      <button
        onClick={onLaunch}
        className="w-full flex items-center justify-center gap-2 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm font-medium transition-colors"
      >
        <Play className="h-3.5 w-3.5" />Launch Phantom
      </button>
    </div>
  );
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="border border-white/10 rounded-xl p-5 space-y-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-white/10 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-white/10 rounded w-3/4" />
          <div className="h-3 bg-white/10 rounded w-1/3" />
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="h-2.5 bg-white/10 rounded w-full" />
        <div className="h-2.5 bg-white/10 rounded w-5/6" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map(i => <div key={i} className="h-12 bg-white/10 rounded-lg" />)}
      </div>
      <div className="h-9 bg-white/10 rounded-lg" />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PhantomsPage() {
  const [phantoms, setPhantoms] = useState<Phantom[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<Set<string>>(new Set());
  const [platFilter, setPlatFilter] = useState<Set<string>>(new Set());
  const [launchPhantom, setLaunchPhantom] = useState<Phantom | null>(null);
  const { toast, showToast } = useToast();

  // Derive dynamic filter option lists from live data
  const categories = useMemo(() => [...new Set(phantoms.map(p => p.category))].sort(), [phantoms]);
  const platforms = useMemo(() => [...new Set(phantoms.map(p =>
    p.platform.charAt(0).toUpperCase() + p.platform.slice(1)
  ))].sort(), [phantoms]);

  useEffect(() => {
    async function load() {
      try {
        // Load real, runnable DB actors (published marketplace actors) so each
        // phantom maps 1:1 to an actor id that /api/runs/enqueue accepts.
        const res = await fetch("/api/actors?store=true");
        if (!res.ok) throw new Error(`Failed to load actors (${res.status})`);
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error("Unexpected response from actors API");
        setPhantoms(data.map(mapActor));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Could not load phantoms.";
        showToast(msg, "error");
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => phantoms.filter(p => {
    const matchSearch = search === "" ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.tags.some(t => t.includes(search.toLowerCase())) ||
      p.category.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter.size === 0 || catFilter.has(p.category);
    const matchPlat = platFilter.size === 0 || platFilter.has(
      p.platform.charAt(0).toUpperCase() + p.platform.slice(1)
    );
    return matchSearch && matchCat && matchPlat;
  }), [phantoms, search, catFilter, platFilter]);

  return (
    <div className="p-6 overflow-y-auto flex-1 space-y-6">
      <ToastBanner toast={toast} />

      {launchPhantom && (
        <LaunchModal
          phantom={launchPhantom}
          onClose={() => setLaunchPhantom(null)}
          showToast={showToast}
        />
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Phantoms</h1>
          <p className="text-sm text-white/40 mt-0.5">Ready-to-use no-code automation for every platform.</p>
        </div>
        {!loading && (
          <p className="text-sm text-white/30">{filtered.length} of {phantoms.length} phantoms</p>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input
            placeholder={loading ? "Loading phantoms…" : `Search ${phantoms.length} Phantoms…`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            disabled={loading}
            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50 disabled:opacity-50"
          />
        </div>
        <div className="flex gap-2">
          <FilterDropdown label="Categories" icon={Filter} options={categories} selected={catFilter} onChange={setCatFilter} />
          <FilterDropdown label="Platform" icon={SlidersHorizontal} options={platforms} selected={platFilter} onChange={setPlatFilter} />
          {(catFilter.size > 0 || platFilter.size > 0) && (
            <button
              onClick={() => { setCatFilter(new Set()); setPlatFilter(new Set()); }}
              className="flex items-center gap-1 px-3 py-2 border border-white/10 rounded-lg text-xs text-white/40 hover:text-white transition-colors"
            >
              <X className="h-3.5 w-3.5" />Clear
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length === 0 && phantoms.length === 0 ? (
        // Empty state — API returned no actors at all
        <div className="flex flex-col items-center justify-center h-64 text-white/30 gap-3">
          <PackageOpen className="h-10 w-10" />
          <p className="text-sm font-medium">No phantoms available</p>
          <p className="text-xs text-white/20">Check back later or contact support.</p>
        </div>
      ) : filtered.length === 0 ? (
        // Empty state — filters/search produced no results
        <div className="flex flex-col items-center justify-center h-40 text-white/30 text-sm gap-2">
          <Search className="h-8 w-8" />
          <p>No phantoms match your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {filtered.map(p => (
            <PhantomCardItem key={p.id} phantom={p} onLaunch={() => setLaunchPhantom(p)} />
          ))}
        </div>
      )}
    </div>
  );
}
