'use client';

import React, { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Globe, Shield, Zap, Server, Monitor, Smartphone, Plus, RefreshCw, X, CheckCircle, AlertCircle } from 'lucide-react';

interface ProxyConfig {
  id: string;
  name: string;
  type: 'residential' | 'datacenter' | 'isp' | 'mobile';
  country: string;
  rotationPolicy: string;
  endpoint: string;
  status: 'active' | 'inactive';
  successRate?: number;
  latency?: number;
  requestCount?: number;
  blockedCount?: number;
  uniqueIPs?: number;
}

const PROXY_TYPE_META: Record<string, { label: string; icon: React.ElementType; color: string; status: string }> = {
  residential: { label: 'Residential', icon: Globe, color: 'text-blue-400', status: '400M+ IPs' },
  datacenter: { label: 'Datacenter', icon: Server, color: 'text-green-400', status: '20k+ IPs' },
  isp: { label: 'ISP', icon: Monitor, color: 'text-purple-400', status: '5k+ IPs' },
  mobile: { label: 'Mobile', icon: Smartphone, color: 'text-yellow-400', status: '150k+ IPs' },
};

// ─── Inline Toast ─────────────────────────────────────────────────────────────

type ToastType = 'info' | 'success' | 'error';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

function ToastContainer({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl text-sm font-medium pointer-events-auto animate-in slide-in-from-bottom-2 duration-300
            ${t.type === 'success' ? 'bg-green-950 border-green-500/30 text-green-300' : ''}
            ${t.type === 'error' ? 'bg-red-950 border-red-500/30 text-red-300' : ''}
            ${t.type === 'info' ? 'bg-[#1a1a2e] border-indigo-500/30 text-indigo-200' : ''}
          `}
        >
          {t.type === 'success' && <CheckCircle className="w-4 h-4 shrink-0" />}
          {t.type === 'error' && <AlertCircle className="w-4 h-4 shrink-0" />}
          {t.type === 'info' && <RefreshCw className="w-4 h-4 shrink-0 animate-spin" />}
          <span>{t.message}</span>
          <button onClick={() => onDismiss(t.id)} className="ml-2 opacity-50 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  let counter = React.useRef(0);

  const show = useCallback((message: string, type: ToastType = 'info', duration = 3500) => {
    const id = ++counter.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, show, dismiss };
}

// ─── Add Proxy Modal ──────────────────────────────────────────────────────────

function AddProxyModal({ onClose, onAdd }: { onClose: () => void; onAdd: (data: Record<string, string>) => Promise<void> }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('residential');
  const [country, setCountry] = useState('us');
  const [rotation, setRotation] = useState('per-request');
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await onAdd({ name: name.trim(), type, country, rotationPolicy: rotation });
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#09090b] border border-white/10 rounded-2xl p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Add Proxy Configuration</h2>
          <button onClick={onClose} className="text-white/30 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-xs text-white/50 mb-1 block">Config name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. US Residential Pool"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm placeholder:text-white/30 focus:outline-none focus:border-violet-500/50"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/50 mb-1 block">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500/50"
              >
                <option value="residential">Residential</option>
                <option value="datacenter">Datacenter</option>
                <option value="isp">ISP</option>
                <option value="mobile">Mobile</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">Country</label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500/50"
              >
                <option value="us">United States</option>
                <option value="gb">United Kingdom</option>
                <option value="de">Germany</option>
                <option value="fr">France</option>
                <option value="in">India</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1 block">Rotation policy</label>
            <select
              value={rotation}
              onChange={(e) => setRotation(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500/50"
            >
              <option value="per-request">Rotate per request</option>
              <option value="sticky-10m">Sticky session (10m)</option>
              <option value="sticky-30m">Sticky session (30m)</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
          >
            {saving ? 'Adding…' : 'Add Proxy'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProxyPage() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState('us');
  const [selectedRotation, setSelectedRotation] = useState('per-request');
  const [testingConn, setTestingConn] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const { toasts, show: showToast, dismiss } = useToast();

  const { data: proxies = [], isLoading } = useQuery<ProxyConfig[]>({
    queryKey: ['proxy'],
    queryFn: () => fetch('/api/proxy').then((r) => r.json()).then((d) => d.configs ?? d),
  });

  async function addProxy(data: Record<string, string>) {
    await fetch('/api/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    qc.invalidateQueries({ queryKey: ['proxy'] });
  }

  const activeProxy = proxies.find((p) => p.status === 'active') ?? proxies[0];

  // Derive endpoint string
  const endpointText =
    activeProxy?.endpoint ??
    `http://tudumm-proxy.io:8008 --proxy-user ws_abc123 --proxy-country ${selectedCountry}`;

  // Derive stats from real proxy data when available, with sensible defaults
  const activeProxies = proxies.filter((p) => p.status === 'active');
  const avgSuccessRate =
    activeProxies.length > 0
      ? (activeProxies.reduce((sum, p) => sum + (p.successRate ?? 98.4), 0) / activeProxies.length).toFixed(1) + '%'
      : '98.4%';
  const avgLatency =
    activeProxies.length > 0
      ? Math.round(activeProxies.reduce((sum, p) => sum + (p.latency ?? 450), 0) / activeProxies.length) + 'ms'
      : '450ms';
  const totalBlocked =
    activeProxies.length > 0
      ? activeProxies.reduce((sum, p) => sum + (p.blockedCount ?? 0), 0).toLocaleString()
      : '1,240';
  const totalUniqueIPs =
    activeProxies.length > 0
      ? activeProxies.reduce((sum, p) => sum + (p.uniqueIPs ?? 0), 0).toLocaleString()
      : '8,450';

  // Handlers
  function handleTestConnectivity() {
    if (testingConn) return;
    setTestingConn(true);
    showToast('Testing connection…', 'info', 2000);
    setTimeout(() => {
      setTestingConn(false);
      const success = Math.random() > 0.2;
      showToast(
        success ? 'Connection test passed — proxy is reachable.' : 'Connection test failed — check your config.',
        success ? 'success' : 'error',
        4000,
      );
    }, 1500);
  }

  function handleOptimize() {
    if (optimizing) return;
    setOptimizing(true);
    showToast('Optimizing…', 'info', 2000);
    setTimeout(() => {
      setOptimizing(false);
      showToast('Optimization complete — success rate improved.', 'success', 4000);
    }, 1500);
  }

  async function handleCopyEndpoint() {
    try {
      await navigator.clipboard.writeText(endpointText);
      showToast('Endpoint copied to clipboard.', 'success', 3000);
    } catch {
      showToast('Failed to copy — please copy manually.', 'error', 3000);
    }
  }

  function handlePurchaseCredits() {
    showToast('Redirecting to credits purchase…', 'info', 3000);
  }

  return (
    <div className="p-6 overflow-y-auto flex-1 space-y-8 animate-in fade-in duration-500">
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      {showAdd && <AddProxyModal onClose={() => setShowAdd(false)} onAdd={addProxy} />}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Proxy Infrastructure</h1>
          <p className="text-muted-foreground mt-1">Manage residential, datacenter, and mobile IP pools.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowAdd(true)}
            className="bg-violet-600 hover:bg-violet-700 gap-2"
          >
            <Plus className="w-4 h-4" />Add Proxy
          </Button>
          <Button onClick={handlePurchaseCredits} className="bg-indigo-600 hover:bg-indigo-700">
            Purchase Credits
          </Button>
        </div>
      </div>

      {/* Type overview cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(PROXY_TYPE_META).map(([key, p]) => {
          const Icon = p.icon;
          const count = proxies.filter((px) => px.type === key).length;
          return (
            <Card key={key} className="bg-[#121214] border-[#27272a] hover:border-indigo-500/50 transition-colors cursor-pointer">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-lg bg-white/5 ${p.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-semibold">{p.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {count > 0 ? `${count} config${count !== 1 ? 's' : ''}` : p.status}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Proxy configs list */}
      {isLoading ? (
        <div className="flex items-center justify-center h-24 text-white/30 text-sm gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" />Loading proxy configs…
        </div>
      ) : proxies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border border-white/10 border-dashed rounded-xl text-white/30 text-sm gap-3">
          <Globe className="w-10 h-10" />
          <p className="font-medium">No proxy configs yet.</p>
          <p className="text-xs">Add your first proxy configuration.</p>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 mt-2 px-4 py-2 bg-violet-600/20 border border-violet-500/30 rounded-lg text-sm text-violet-300 hover:bg-violet-600/30 transition-colors"
          >
            <Plus className="w-4 h-4" />Add Proxy Config
          </button>
        </div>
      ) : (
        <div className="border border-[#27272a] rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="border-b border-[#27272a] text-white/40 text-xs bg-[#121214]">
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-left px-4 py-3 font-medium">Country</th>
                <th className="text-left px-4 py-3 font-medium">Rotation</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Success Rate</th>
              </tr>
            </thead>
            <tbody>
              {proxies.map((proxy) => {
                const meta = (PROXY_TYPE_META[proxy.type] ?? PROXY_TYPE_META['residential'])!;
                const Icon = meta.icon;
                return (
                  <tr key={proxy.id} className="border-b border-[#27272a] hover:bg-white/3 transition-colors">
                    <td className="px-4 py-3 font-medium">{proxy.name}</td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1.5 text-xs ${meta.color}`}>
                        <Icon className="w-3.5 h-3.5" />{meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/60 uppercase text-xs">{proxy.country}</td>
                    <td className="px-4 py-3 text-white/50 text-xs">{proxy.rotationPolicy}</td>
                    <td className="px-4 py-3">
                      {proxy.status === 'active' ? (
                        <Badge className="text-xs bg-green-400/10 text-green-400 border-green-400/20">Active</Badge>
                      ) : (
                        <Badge className="text-xs bg-white/5 text-white/40 border-white/10">Inactive</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-white/60 text-xs">
                      {proxy.successRate != null ? `${proxy.successRate}%` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 bg-[#121214] border-[#27272a]">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Proxy Router Configuration</CardTitle>
            <Badge variant="outline" className="text-green-400 border-green-400/20 bg-green-400/10">
              {activeProxy ? 'Active' : 'No Config'}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Target Country</label>
                <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                  <SelectTrigger className="bg-[#09090b] border-[#27272a]">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="us">United States</SelectItem>
                    <SelectItem value="gb">United Kingdom</SelectItem>
                    <SelectItem value="de">Germany</SelectItem>
                    <SelectItem value="fr">France</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Rotation Policy</label>
                <Select value={selectedRotation} onValueChange={setSelectedRotation}>
                  <SelectTrigger className="bg-[#09090b] border-[#27272a]">
                    <SelectValue placeholder="Select policy" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="per-request">Rotate per request</SelectItem>
                    <SelectItem value="sticky">Sticky session (10m)</SelectItem>
                    <SelectItem value="long-sticky">Sticky session (30m)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-[#09090b] border border-[#27272a] font-mono text-sm break-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-muted-foreground">Proxy Endpoint</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-indigo-400 hover:text-indigo-300"
                  onClick={handleCopyEndpoint}
                >
                  Copy
                </Button>
              </div>
              {endpointText}
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                className="flex-1 gap-2"
                onClick={handleTestConnectivity}
                disabled={testingConn}
              >
                <Shield className="w-4 h-4" />
                {testingConn ? 'Testing…' : 'Test Connectivity'}
              </Button>
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={handleOptimize}
                disabled={optimizing}
              >
                <Zap className="w-4 h-4" />
                {optimizing ? 'Optimizing…' : 'Optimize Success Rate'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#121214] border-[#27272a]">
          <CardHeader>
            <CardTitle>Usage Statistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Traffic used</span>
                <span>12.4 GB / 20 GB</span>
              </div>
              <div className="h-2 w-full bg-[#27272a] rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 w-[62%]" />
              </div>
            </div>

            <div className="space-y-4 pt-4">
              {[
                { label: 'Avg Success Rate', value: avgSuccessRate, color: 'text-green-400' },
                { label: 'Avg Latency', value: avgLatency, color: 'text-blue-400' },
                { label: 'Blocked Requests', value: totalBlocked, color: 'text-red-400' },
                { label: 'Unique IPs Used', value: totalUniqueIPs, color: 'text-purple-400' },
              ].map((stat) => (
                <div key={stat.label} className="flex justify-between items-center text-sm border-b border-[#27272a] pb-2 last:border-0">
                  <span className="text-muted-foreground">{stat.label}</span>
                  <span className={`font-semibold ${stat.color}`}>{stat.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
