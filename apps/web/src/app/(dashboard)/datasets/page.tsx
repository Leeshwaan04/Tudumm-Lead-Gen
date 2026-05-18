'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Database, Download, Search, Eye, Trash2, Plus,
  FileJson, FileText, Table, Loader2, RefreshCw, UploadCloud,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Dataset {
  id: string
  name: string
  itemCount: number
  sizeBytes: number
  createdAt: string
  actorName: string
  status?: string
}

interface DatasetDetail extends Dataset {
  items: Record<string, unknown>[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function triggerDownload(data: string, filename: string, type: string) {
  const blob = new Blob([data], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const PAGE_SIZE = 20

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DatasetsPage() {
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'table' | 'json'>('table')
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<DatasetDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [page, setPage] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const [exporting, setExporting] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  const fetchDatasets = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetch('/api/datasets').then(r => r.json())
      const list: Dataset[] = (Array.isArray(data) ? data : []).map((d: Record<string, unknown>) => ({
        id: d.id as string,
        name: d.name as string,
        itemCount: (d.itemCount as number) ?? 0,
        sizeBytes: (d.sizeBytes as number) ?? 0,
        createdAt: d.createdAt as string,
        actorName: ((d.run as Record<string, unknown>)?.actor as Record<string, unknown>)?.name as string ?? 'Unknown Actor',
        status: d.status as string | undefined,
      }))
      setDatasets(list)
      if (list.length > 0 && !selectedId) setSelectedId(list[0]?.id ?? null)
    } catch { setDatasets([]) }
    setLoading(false)
  }, [selectedId])

  useEffect(() => { fetchDatasets() }, [fetchDatasets])

  useEffect(() => {
    if (!selectedId) { setDetail(null); return }
    setDetailLoading(true)
    setPage(0)
    fetch(`/api/datasets/${selectedId}`)
      .then(r => r.json())
      .then(data => {
        const items = Array.isArray(data.items) ? data.items : []
        setDetail({
          id: data.id,
          name: data.name,
          itemCount: data.itemCount ?? items.length,
          sizeBytes: data.sizeBytes ?? 0,
          createdAt: data.createdAt,
          actorName: data.run?.actor?.name ?? 'Unknown Actor',
          status: data.status,
          items,
        })
      })
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false))
  }, [selectedId])

  const filtered = datasets.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.actorName.toLowerCase().includes(search.toLowerCase())
  )

  const items = detail?.items ?? []
  const cols = items.length > 0 ? Object.keys(items[0] ?? {}) : []
  const pageItems = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(items.length / PAGE_SIZE)

  async function exportDataset(format: string) {
    if (!selectedId) return
    setExporting(format)
    try {
      const data = await fetch(`/api/datasets/${selectedId}/export?format=${format}`).then(r => r.text())
      const ext = format === 'ndjson' ? 'ndjson' : format
      const mimeMap: Record<string, string> = {
        csv: 'text/csv',
        json: 'application/json',
        ndjson: 'application/x-ndjson',
      }
      triggerDownload(data, `dataset-${selectedId}.${ext}`, mimeMap[format] ?? 'text/plain')
    } catch { showToast('Export failed.') }
    setExporting(null)
  }

  async function pushToLeads() {
    if (!selectedId) return
    setImporting(true)
    try {
      const res = await fetch('/api/leads/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datasetId: selectedId }),
      })
      const data = await res.json()
      showToast(`Imported ${data.count ?? 'some'} leads!`)
    } catch { showToast('Import failed.') }
    setImporting(false)
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
      </div>
    )
  }

  return (
    <div className="flex flex-1 min-h-0">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2 bg-violet-600 text-white text-sm rounded-xl shadow-xl">{toast}</div>
      )}

      {/* Left sidebar */}
      <div className="w-72 shrink-0 border-r border-white/10 flex flex-col">
        <div className="p-4 border-b border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold">Datasets</h1>
            <button onClick={fetchDatasets} className="p-1.5 rounded-lg border border-white/10 hover:bg-white/5 transition-colors">
              <RefreshCw className="h-3.5 w-3.5 text-white/40" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-white/40" />
            <input
              className="w-full pl-8 pr-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg outline-none focus:border-violet-500"
              placeholder="Search datasets…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-white/30 text-xs gap-2 p-4 text-center">
              <Database className="h-6 w-6" />
              <p>{datasets.length === 0 ? 'No datasets yet. Run actors to generate data.' : 'No datasets match your search.'}</p>
            </div>
          ) : filtered.map(ds => (
            <button
              key={ds.id}
              onClick={() => setSelectedId(ds.id)}
              className={`w-full text-left p-3 border-b border-white/5 hover:bg-white/5 transition-colors ${selectedId === ds.id ? 'bg-white/8 border-l-2 border-l-violet-500' : ''}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Database className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                <span className="text-sm font-medium truncate">{ds.name}</span>
              </div>
              <div className="text-xs text-white/40 space-y-0.5 ml-5">
                <p>{ds.itemCount.toLocaleString()} items · {formatSize(ds.sizeBytes)}</p>
                <p className="truncate">{ds.actorName}</p>
                <p>{new Date(ds.createdAt).toLocaleDateString()}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      {!detail && !detailLoading ? (
        <div className="flex-1 flex items-center justify-center text-white/30 text-sm">
          Select a dataset to view its contents
        </div>
      ) : detailLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-violet-400" />
        </div>
      ) : detail && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-5 border-b border-white/10 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold mb-1">{detail.name}</h2>
              <div className="flex items-center gap-4 text-sm text-white/40 flex-wrap">
                <span>{detail.itemCount.toLocaleString()} items</span>
                <span>{formatSize(detail.sizeBytes)}</span>
                <span>{new Date(detail.createdAt).toLocaleDateString()}</span>
                <span className="font-mono text-xs">{detail.id}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={pushToLeads}
                disabled={importing}
                className="flex items-center gap-1.5 px-3 py-2 bg-violet-600/20 border border-violet-500/30 text-violet-300 hover:bg-violet-600/30 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {importing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
                Push to Leads
              </button>
              <button
                onClick={() => showToast('Delete coming soon.')}
                className="flex items-center gap-1.5 px-3 py-2 border border-white/10 hover:bg-white/5 rounded-lg text-sm transition-colors text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" />Delete
              </button>
              <div className="flex border border-white/10 rounded-lg overflow-hidden">
                {[
                  { fmt: 'csv',    label: 'CSV',    icon: Table },
                  { fmt: 'json',   label: 'JSON',   icon: FileJson },
                  { fmt: 'ndjson', label: 'NDJSON', icon: FileText },
                ].map(({ fmt, label, icon: Icon }) => (
                  <button
                    key={fmt}
                    onClick={() => exportDataset(fmt)}
                    disabled={exporting === fmt}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm hover:bg-white/5 transition-colors border-r border-white/10 last:border-r-0 disabled:opacity-50"
                  >
                    {exporting === fmt ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    <Icon className="h-3.5 w-3.5" />{label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* View toggle */}
          <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2">
            <button onClick={() => setView('table')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${view === 'table' ? 'bg-violet-600 text-white' : 'text-white/60 hover:bg-white/5'}`}>
              <Table className="h-3.5 w-3.5" />Table
            </button>
            <button onClick={() => setView('json')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${view === 'json' ? 'bg-violet-600 text-white' : 'text-white/60 hover:bg-white/5'}`}>
              <Eye className="h-3.5 w-3.5" />JSON
            </button>
          </div>

          {/* Data view */}
          <div className="flex-1 overflow-auto">
            {items.length === 0 ? (
              <div className="flex items-center justify-center h-full text-white/30 text-sm">No items in this dataset.</div>
            ) : view === 'table' ? (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[#0d0d14] border-b border-white/10 z-10">
                  <tr>
                    <th className="text-left px-4 py-3 text-white/40 font-medium text-xs uppercase tracking-wider w-8">#</th>
                    {cols.map(col => (
                      <th key={col} className="text-left px-4 py-3 text-white/40 font-medium text-xs uppercase tracking-wider">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((item, i) => (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                      <td className="px-4 py-3 text-white/30 text-xs">{page * PAGE_SIZE + i + 1}</td>
                      {cols.map(col => (
                        <td key={col} className="px-4 py-3 text-white/80 max-w-[200px] truncate">
                          {String(item[col] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <pre className="p-6 text-xs font-mono text-green-400/80 leading-relaxed">
                {JSON.stringify(pageItems, null, 2)}
              </pre>
            )}
          </div>

          {/* Pagination */}
          <div className="px-5 py-3 border-t border-white/10 flex items-center justify-between text-sm text-white/40">
            <span>
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, items.length)} of {items.length.toLocaleString()} items
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1 border border-white/10 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-30"
              >
                Previous
              </button>
              <span className="text-xs">{page + 1} / {totalPages || 1}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-3 py-1 border border-white/10 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-30"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
