"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Filter, SlidersHorizontal, X, Play, Zap, Clock,
  RefreshCw, ChevronDown, CheckSquare, Square,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Phantom {
  id: string;
  name: string;
  platform: string;
  category: string;
  description: string;
  icon: string;
  creditsPerRun: number;
  averageDuration: number;
  totalLaunches: number;
  outputFields: string[];
  isPopular: boolean;
  tags: string[];
  actorSlug?: string;
}

// ─── Hardcoded phantoms ───────────────────────────────────────────────────────

const PHANTOMS: Phantom[] = [
  { id: "1", name: "LinkedIn Profile Scraper", platform: "linkedin", category: "Scraping", description: "Extract profile data from LinkedIn search results at scale.", icon: "💼", creditsPerRun: 5, averageDuration: 180, totalLaunches: 45200, outputFields: ["name","title","company","email"], isPopular: true, tags: ["linkedin","profiles","b2b"], actorSlug: "linkedin-profile-scraper" },
  { id: "2", name: "LinkedIn Auto-Connect", platform: "linkedin", category: "Automation", description: "Automatically send connection requests with personalised notes.", icon: "🤝", creditsPerRun: 2, averageDuration: 60, totalLaunches: 128000, outputFields: ["status","acceptRate"], isPopular: true, tags: ["linkedin","outreach","automation"], actorSlug: "linkedin-auto-connect" },
  { id: "3", name: "Instagram Follower Collector", platform: "instagram", category: "Scraping", description: "Collect follower lists from any public Instagram account.", icon: "📸", creditsPerRun: 4, averageDuration: 120, totalLaunches: 22000, outputFields: ["username","followers","bio"], isPopular: false, tags: ["instagram","followers","influencer"] },
  { id: "4", name: "Google Maps Extractor", platform: "google", category: "Leads", description: "Scrape business listings including phone, address, and reviews.", icon: "🔍", creditsPerRun: 6, averageDuration: 240, totalLaunches: 89000, outputFields: ["name","address","phone","rating"], isPopular: true, tags: ["google-maps","local","business"], actorSlug: "google-maps-scraper" },
  { id: "5", name: "Twitter Profile Scraper", platform: "twitter", category: "Scraping", description: "Extract public profile data and recent tweets from Twitter/X.", icon: "🐦", creditsPerRun: 3, averageDuration: 90, totalLaunches: 15000, outputFields: ["username","bio","followers","tweets"], isPopular: false, tags: ["twitter","profiles","social"] },
  { id: "6", name: "GitHub Stars Extractor", platform: "github", category: "Developer", description: "Get a list of all users who starred a GitHub repository.", icon: "🐙", creditsPerRun: 2, averageDuration: 45, totalLaunches: 8400, outputFields: ["username","email","location"], isPopular: false, tags: ["github","developers","oss"], actorSlug: "github-stars-extractor" },
  { id: "7", name: "YouTube Channel Scraper", platform: "youtube", category: "Scraping", description: "Collect video metadata, view counts, and channel stats.", icon: "▶️", creditsPerRun: 4, averageDuration: 150, totalLaunches: 31000, outputFields: ["title","views","likes","publishedAt"], isPopular: false, tags: ["youtube","video","content"] },
  { id: "8", name: "LinkedIn Sales Nav Scraper", platform: "linkedin", category: "Leads", description: "Export leads from LinkedIn Sales Navigator search results.", icon: "💼", creditsPerRun: 10, averageDuration: 300, totalLaunches: 94000, outputFields: ["name","title","company","email","phone"], isPopular: true, tags: ["linkedin","sales-nav","enterprise"], actorSlug: "linkedin-sales-nav-scraper" },
];

const CATEGORIES = ["Scraping", "Automation", "Leads", "Developer"];
const PLATFORMS = ["LinkedIn", "Instagram", "Twitter", "Google", "GitHub", "YouTube"];

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

// ─── Launch Modal ─────────────────────────────────────────────────────────────

function LaunchModal({ phantom, onClose }: { phantom: Phantom; onClose: () => void }) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [launching, setLaunching] = useState(false);
  const [done, setDone] = useState(false);

  const isLinkedIn = phantom.platform === "linkedin";
  const isGoogle = phantom.platform === "google";

  async function launch() {
    setLaunching(true);
    let inputObj: Record<string, unknown> = {};
    if (isLinkedIn) {
      inputObj = { url: input, maxResults: 100 };
    } else if (isGoogle) {
      inputObj = { query: input };
    } else {
      try { inputObj = JSON.parse(input || "{}"); } catch { inputObj = { query: input }; }
    }
    try {
      // Find actor by slug
      let actorId = phantom.actorSlug ?? phantom.name.toLowerCase().replace(/\s+/g, "-");
      const actorsData = await fetch(`/api/actors?search=${encodeURIComponent(phantom.name)}`).then(r => r.json()).catch(() => []);
      if (Array.isArray(actorsData) && actorsData.length > 0) {
        actorId = actorsData[0].id;
      }
      await fetch("/api/runs/enqueue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorId, input: inputObj }),
      });
      setDone(true);
      setTimeout(() => { onClose(); router.push("/actors"); }, 1500);
    } catch { setLaunching(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#09090b] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{phantom.icon}</span>
            <div>
              <h2 className="text-base font-semibold">{phantom.name}</h2>
              <p className="text-xs text-white/40 flex items-center gap-1"><Zap className="h-3 w-3 text-amber-400" />{phantom.creditsPerRun} credits/run</p>
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
                  <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="https://www.linkedin.com/search/results/people/..."
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/50"
                  />
                </>
              ) : isGoogle ? (
                <>
                  <label className="text-xs text-white/50 mb-1 block">Search Query</label>
                  <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="coffee shops in New York"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/50"
                  />
                </>
              ) : (
                <>
                  <label className="text-xs text-white/50 mb-1 block">Input JSON or Search Query</label>
                  <textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    rows={4}
                    placeholder='{"key": "value"}'
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-mono text-white placeholder:text-white/20 resize-none focus:outline-none focus:border-violet-500/50"
                  />
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
          <div className="flex items-center justify-center gap-1 text-amber-400 font-semibold"><Zap className="h-3 w-3" />{phantom.creditsPerRun}</div>
          <div className="text-white/30 mt-0.5">credits/run</div>
        </div>
        <div className="rounded-lg bg-white/5 p-2">
          <div className="flex items-center justify-center gap-1 text-white/60 font-semibold"><Clock className="h-3 w-3" />{phantom.averageDuration}m</div>
          <div className="text-white/30 mt-0.5">avg time</div>
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PhantomsPage() {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<Set<string>>(new Set());
  const [platFilter, setPlatFilter] = useState<Set<string>>(new Set());
  const [launchPhantom, setLaunchPhantom] = useState<Phantom | null>(null);

  const filtered = useMemo(() => PHANTOMS.filter(p => {
    const matchSearch = search === "" ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.tags.some(t => t.includes(search.toLowerCase())) ||
      p.category.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter.size === 0 || catFilter.has(p.category);
    const matchPlat = platFilter.size === 0 || platFilter.has(
      p.platform.charAt(0).toUpperCase() + p.platform.slice(1)
    );
    return matchSearch && matchCat && matchPlat;
  }), [search, catFilter, platFilter]);

  return (
    <div className="p-6 overflow-y-auto flex-1 space-y-6">
      {launchPhantom && <LaunchModal phantom={launchPhantom} onClose={() => setLaunchPhantom(null)} />}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Phantoms</h1>
          <p className="text-sm text-white/40 mt-0.5">Ready-to-use no-code automation for every platform.</p>
        </div>
        <p className="text-sm text-white/30">{filtered.length} of {PHANTOMS.length} phantoms</p>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input
            placeholder="Search 8 Phantoms…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50"
          />
        </div>
        <div className="flex gap-2">
          <FilterDropdown label="Categories" icon={Filter} options={CATEGORIES} selected={catFilter} onChange={setCatFilter} />
          <FilterDropdown label="Platform" icon={SlidersHorizontal} options={PLATFORMS} selected={platFilter} onChange={setPlatFilter} />
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

      {filtered.length === 0 ? (
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
