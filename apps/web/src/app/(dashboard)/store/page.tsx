"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Star, Play, TrendingUp, Zap, Users, Code2,
  RefreshCw, X, Plus, ExternalLink,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Actor {
  id: string;
  name: string;
  slug: string;
  description: string;
  categories: string;
  tags: string;
  totalRuns: number;
  rating: number;
  ratingCount: number;
  isPublic: boolean;
  status: string;
  author?: string;
  paid?: boolean;
  pricePerRun?: number;
}

function formatRuns(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function parseJSON<T>(s: string, fallback: T): T {
  try { return JSON.parse(s) as T; } catch { return fallback; }
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function StoreToast({ msg, type, onClose }: { msg: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) }, [onClose]);
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl text-sm ${type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-300' : 'bg-red-500/10 border-red-500/30 text-red-300'}`}>
      <span>{msg}</span>
      <button onClick={onClose}><X className="h-3.5 w-3.5 opacity-60" /></button>
    </div>
  );
}

const PLATFORMS = ["All", "LinkedIn", "Google", "Twitter", "Instagram", "GitHub", "YouTube"];

// ─── Run Config Modal ─────────────────────────────────────────────────────────

function RunModal({ actor, onClose, onToast }: { actor: Actor; onClose: () => void; onToast: (msg: string, type: 'success' | 'error') => void }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [maxResults, setMaxResults] = useState("100");
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [jsonInput, setJsonInput] = useState("{}");
  const [launching, setLaunching] = useState(false);
  const [done, setDone] = useState(false);

  const isLinkedIn = actor.slug?.includes("linkedin");
  const isGoogleMaps = actor.slug?.includes("google") || actor.slug?.includes("maps");

  async function launch() {
    setLaunching(true);
    let input: Record<string, unknown> = {};
    if (isLinkedIn) {
      input = { url, maxResults: Number(maxResults) };
    } else if (isGoogleMaps) {
      input = { query, location };
    } else {
      try { input = JSON.parse(jsonInput); } catch { input = {}; }
    }
    try {
      const res = await fetch("/api/runs/enqueue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorId: actor.id, input }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? "Failed to launch run");
      }
      setDone(true);
    } catch (e: any) {
      onToast(e.message ?? "Failed to launch run", "error");
      setLaunching(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#09090b] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{actor.name}</h2>
          <button onClick={onClose} className="text-white/30 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        {done ? (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <div className="h-12 w-12 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center">
              <Play className="h-5 w-5 text-green-400" />
            </div>
            <p className="text-sm font-medium text-green-400">Run queued!</p>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm border border-white/10 rounded-lg hover:bg-white/5 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => { onClose(); router.push("/actors"); }}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />View Run
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {isLinkedIn ? (
                <>
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">LinkedIn Search URL</label>
                    <input
                      value={url}
                      onChange={e => setUrl(e.target.value)}
                      placeholder="https://www.linkedin.com/search/results/people/..."
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm placeholder:text-white/20 text-white focus:outline-none focus:border-violet-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Max Results</label>
                    <input
                      type="number"
                      value={maxResults}
                      onChange={e => setMaxResults(e.target.value)}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500/50"
                    />
                  </div>
                </>
              ) : isGoogleMaps ? (
                <>
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Search Query</label>
                    <input
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      placeholder="coffee shops, dentists, restaurants..."
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm placeholder:text-white/20 text-white focus:outline-none focus:border-violet-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Location</label>
                    <input
                      value={location}
                      onChange={e => setLocation(e.target.value)}
                      placeholder="New York, NY"
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm placeholder:text-white/20 text-white focus:outline-none focus:border-violet-500/50"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Input JSON</label>
                  <textarea
                    value={jsonInput}
                    onChange={e => setJsonInput(e.target.value)}
                    rows={5}
                    placeholder='{"key": "value"}'
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-mono placeholder:text-white/20 text-white resize-none focus:outline-none focus:border-violet-500/50"
                  />
                </div>
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
                Launch
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Publish Actor Modal ──────────────────────────────────────────────────────

function PublishModal({ onClose, onToast }: { onClose: () => void; onToast: (msg: string, type: 'success' | 'error') => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const CATS = ["Scraping", "Automation", "Leads", "Enrichment", "Analytics", "Developer"];

  function toggleCat(c: string) {
    setCategories(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/actors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          categories: JSON.stringify(categories),
          tags: JSON.stringify(tags.split(",").map(t => t.trim()).filter(Boolean)),
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? errData.message ?? "Failed to publish actor");
      }
      setDone(true);
      setTimeout(onClose, 1500);
    } catch (e: any) {
      onToast(e.message ?? "Failed to publish actor", "error");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#09090b] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Publish Actor</h2>
          <button onClick={onClose} className="text-white/30 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        {done ? (
          <div className="flex items-center justify-center py-8 text-green-400 text-sm gap-2">
            <Plus className="h-5 w-5" />Actor published!
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-xs text-white/50 mb-1 block">Actor Name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="My LinkedIn Scraper"
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/50" autoFocus />
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="What does this actor do?"
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/20 resize-none focus:outline-none focus:border-violet-500/50" />
            </div>
            <div>
              <label className="text-xs text-white/50 mb-2 block">Categories</label>
              <div className="flex flex-wrap gap-2">
                {CATS.map(c => (
                  <button key={c} type="button" onClick={() => toggleCat(c)}
                    className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${categories.includes(c) ? 'bg-violet-600 border-violet-500 text-white' : 'border-white/10 text-white/60 hover:border-white/20'}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">Tags (comma-separated)</label>
              <input value={tags} onChange={e => setTags(e.target.value)} placeholder="linkedin, b2b, profiles"
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/50" />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-white/10 rounded-lg hover:bg-white/5 transition-colors">Cancel</button>
              <button type="submit" disabled={saving || !name.trim()} className="px-4 py-2 text-sm bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-lg transition-colors">
                {saving ? "Publishing…" : "Publish"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StorePage() {
  const [actors, setActors] = useState<Actor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [activePlatform, setActivePlatform] = useState("All");
  const [runActor, setRunActor] = useState<Actor | null>(null);
  const [showPublish, setShowPublish] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type });
  }

  useEffect(() => {
    fetch("/api/actors?store=true")
      .then(r => r.json())
      .then(data => setActors(Array.isArray(data) ? data : []))
      .catch(() => setActors([]))
      .finally(() => setLoading(false));
  }, []);

  const allCategories = useMemo(() => {
    const cats = new Set<string>(["All"]);
    actors.forEach(a => parseJSON<string[]>(a.categories, []).forEach(c => cats.add(c)));
    return Array.from(cats);
  }, [actors]);

  const filtered = actors.filter(a => {
    const matchSearch = a.name.toLowerCase().includes(search.toLowerCase()) || a.description.toLowerCase().includes(search.toLowerCase());
    const cats = parseJSON<string[]>(a.categories, []);
    const matchCat = activeCategory === "All" || cats.includes(activeCategory);
    const matchPlatform = activePlatform === "All" || a.slug?.includes(activePlatform.toLowerCase()) || a.name.toLowerCase().includes(activePlatform.toLowerCase());
    return matchSearch && matchCat && matchPlatform;
  });

  const totalRuns = actors.reduce((s, a) => s + (a.totalRuns ?? 0), 0);

  // Unique authors/developers count from data
  const developerCount = useMemo(() => {
    const devs = new Set<string>();
    actors.forEach(a => { if (a.author) devs.add(a.author); });
    return devs.size > 0 ? devs.size.toLocaleString() : actors.length > 0 ? actors.length.toLocaleString() : "0";
  }, [actors]);

  return (
    <div className="p-6 overflow-y-auto flex-1 space-y-6">
      {toast && <StoreToast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {runActor && (
        <RunModal
          actor={runActor}
          onClose={() => setRunActor(null)}
          onToast={showToast}
        />
      )}
      {showPublish && (
        <PublishModal
          onClose={() => setShowPublish(false)}
          onToast={showToast}
        />
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Actor Store</h1>
          <p className="text-sm text-white/40 mt-0.5">
            {loading ? "Loading actors…" : `${actors.length.toLocaleString()} automation actors`}
          </p>
        </div>
        <button
          onClick={() => setShowPublish(true)}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm font-medium transition-colors"
        >
          <Code2 className="h-4 w-4" />Publish Actor
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Actors",  value: loading ? "…" : actors.length.toLocaleString(), icon: Zap,       color: "text-violet-400" },
          { label: "Total Runs",    value: loading ? "…" : formatRuns(totalRuns),            icon: TrendingUp, color: "text-emerald-400" },
          { label: "Developers",    value: loading ? "…" : developerCount,                   icon: Users,      color: "text-blue-400"   },
        ].map(stat => (
          <div key={stat.label} className="border border-white/10 rounded-xl p-4 flex items-center gap-3">
            <stat.icon className={`h-5 w-5 ${stat.color}`} />
            <div>
              <p className="text-lg font-bold">{stat.value}</p>
              <p className="text-xs text-white/40">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
        <input
          placeholder="Search actors…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50"
        />
      </div>

      {/* Category filter — scrollable on mobile */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {allCategories.map(cat => (
          <button key={cat} onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all shrink-0 ${activeCategory === cat ? 'bg-violet-600 text-white border-violet-600' : 'border-white/10 text-white/50 hover:border-violet-500/50 hover:text-white'}`}>
            {cat}
          </button>
        ))}
      </div>

      {/* Platform filter — scrollable on mobile */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {PLATFORMS.map(p => (
          <button key={p} onClick={() => setActivePlatform(p)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all shrink-0 ${activePlatform === p ? 'bg-indigo-600 text-white border-indigo-600' : 'border-white/10 text-white/40 hover:border-indigo-500/50 hover:text-white'}`}>
            {p}
          </button>
        ))}
      </div>

      {/* Actor grid */}
      {loading ? (
        <div className="flex items-center justify-center h-40 text-white/30 text-sm gap-2">
          <RefreshCw className="h-4 w-4 animate-spin" />Loading actors…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-white/30 text-sm gap-2">
          <Search className="h-8 w-8" />
          <p>No actors match your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {filtered.map(actor => {
            const tags = parseJSON<string[]>(actor.tags, []);
            const cats = parseJSON<string[]>(actor.categories, []);
            const paid = actor.paid ?? false;
            const price = actor.pricePerRun ?? 0;
            return (
              <div key={actor.id} className="group border border-white/10 hover:border-violet-500/40 rounded-xl p-5 space-y-4 transition-all hover:shadow-lg hover:shadow-violet-500/10 flex flex-col">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-xl shrink-0">
                      {actor.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-sm leading-tight group-hover:text-violet-300 transition-colors">{actor.name}</p>
                      <p className="text-xs text-white/40">by {actor.author ?? "Tudumm"}</p>
                    </div>
                  </div>
                  {paid
                    ? <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">${price}/run</span>
                    : <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Free</span>
                  }
                </div>

                <p className="text-xs text-white/50 leading-relaxed flex-1">{actor.description}</p>

                {cats.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {cats.slice(0, 2).map(c => (
                      <span key={c} className="text-xs px-1.5 py-0.5 bg-violet-500/10 text-violet-400 rounded border border-violet-500/20">{c}</span>
                    ))}
                  </div>
                )}

                {tags.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {tags.slice(0, 3).map(t => (
                      <span key={t} className="text-xs px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-white/30">{t}</span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs text-white/40">
                    <span className="flex items-center gap-1">
                      <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                      {actor.rating?.toFixed(1) ?? "—"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Play className="h-3 w-3" />{formatRuns(actor.totalRuns ?? 0)}
                    </span>
                  </div>
                  <button
                    onClick={() => setRunActor(actor)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 rounded-lg text-xs transition-colors"
                  >
                    <Play className="h-3 w-3" />Run
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
