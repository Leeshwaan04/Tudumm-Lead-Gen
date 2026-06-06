import { prisma } from '@/lib/db'
import { uploadJSON } from '@/lib/storage'
import { aiExtract } from '@/lib/ai-extract'

// ─── Workflow execution engine ──────────────────────────────────────────────
// Nodes are executed in topological order. Each node receives the items emitted
// by its parent node(s), transforms/acts on them, and emits items to its
// children — a real data pipeline, not independent fire-and-forget steps.

type Item = Record<string, any>
const BROWSER_SERVICE_URL = process.env.BROWSER_SERVICE_URL || 'http://localhost:8007'
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

function firstName(it: Item): string {
  return it.firstName || it.fullName?.split(' ')?.[0] || it.name?.split(' ')?.[0] || ''
}

/** Real AI enrichment of one item via Groq. Falls back to a heuristic score. */
async function enrichItem(it: Item): Promise<Item> {
  const apiKey = process.env.GROQ_API_KEY
  const title = String(it.title ?? it.headline ?? '')
  const heuristic = /cto|ceo|vp|founder|director|head/i.test(title) ? 88
    : /manager|lead/i.test(title) ? 75 : 64
  if (!apiKey) return { ...it, icpScore: it.icpScore ?? heuristic }
  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 400, temperature: 0.3,
        messages: [
          { role: 'system', content: 'You are a B2B sales analyst. Respond with valid JSON only.' },
          { role: 'user', content: `Lead: name=${it.fullName ?? it.name ?? ''}, title=${title}, company=${it.company ?? ''}. Return JSON {icpScore:0-100 int, aiSummary:string, outreachAngle:string}.` },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error?.message || 'groq error')
    const text = data.choices?.[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? '{}')
    return {
      ...it,
      icpScore: parsed.icpScore ?? heuristic,
      aiSummary: parsed.aiSummary ?? '',
      outreachAngle: parsed.outreachAngle ?? '',
    }
  } catch {
    return { ...it, icpScore: it.icpScore ?? heuristic }
  }
}

/** Execute one node. Returns { items, summary, skipped }. */
async function executeNode(
  slug: string,
  cfg: Record<string, any>,
  input: Item[],
  workspaceId: string,
): Promise<{ items: Item[]; summary: string; skipped?: boolean }> {
  switch (slug) {
    case 'scrape-linkedin':
    case 'scrape-google-maps':
    case 'scrape-twitter':
    case 'scrape-instagram':
    case 'scrape-github':
    case 'scrape-web': {
      let url = cfg.url || cfg.searchUrl
      // Google Maps node configures a free-text query + optional location instead of a URL.
      if (!url && slug === 'scrape-google-maps' && cfg.query) {
        const q = [cfg.query, cfg.location].filter(Boolean).join(' ')
        url = `https://www.google.com/maps/search/${encodeURIComponent(q)}`
      }
      if (!url && cfg.query) url = `https://www.google.com/search?q=${encodeURIComponent(cfg.query)}`
      if (!url) return { items: input, summary: 'no URL or query configured — skipped', skipped: true }
      const res = await fetch(`${BROWSER_SERVICE_URL}/browser/scrape`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, waitFor: 'domcontentloaded' }),
        signal: AbortSignal.timeout(120000),
      })
      if (!res.ok) throw new Error(`scrape failed: ${res.status}`)
      const r = await res.json()
      // AI-assisted extraction: if the user described what to pull, turn the page
      // into exactly those structured rows (firms, advisors, handles, emails…).
      if (cfg.extractPrompt && typeof r.text === 'string' && r.text.length > 40) {
        const aiItems = await aiExtract(r.text, String(cfg.extractPrompt))
        if (aiItems.length) return { items: [...input, ...aiItems], summary: `AI-extracted ${aiItems.length} item(s)` }
      }
      const items: Item[] = Array.isArray(r.extracted) ? r.extracted
        : r.extracted ? [r.extracted]
        : [{ url: r.url ?? url, title: (r.text ?? '').slice(0, 120), text: (r.text ?? '').slice(0, 5000), scrapedAt: new Date().toISOString() }]
      return { items: [...input, ...items], summary: `scraped ${items.length} item(s)` }
    }

    case 'ai-enrich': {
      if (input.length === 0) return { items: [], summary: 'no input items' }
      const enriched: Item[] = []
      for (const it of input.slice(0, 50)) enriched.push(await enrichItem(it))
      const avg = Math.round(enriched.reduce((s, i) => s + (i.icpScore ?? 0), 0) / (enriched.length || 1))
      return { items: enriched, summary: `enriched ${enriched.length} item(s), avg ICP ${avg}` }
    }

    case 'icp-score-filter': {
      const min = Number(cfg.minScore ?? 70)
      const kept = input.filter(i => (i.icpScore ?? 0) >= min)
      return { items: kept, summary: `kept ${kept.length}/${input.length} with ICP ≥ ${min}` }
    }

    case 'email-found': {
      const kept = input.filter(i => i.email && String(i.email).includes('@'))
      return { items: kept, summary: `kept ${kept.length}/${input.length} with email` }
    }

    case 'has-phone': {
      const kept = input.filter(i => i.phone || i.phoneNumber)
      return { items: kept, summary: `kept ${kept.length}/${input.length} with phone` }
    }

    case 'add-to-sequence': {
      const sequenceId = cfg.sequenceId
      if (!sequenceId) return { items: input, summary: 'no sequenceId configured — skipped', skipped: true }
      const seq = await prisma.sequence.findFirst({ where: { id: sequenceId, workspaceId } })
      if (!seq) return { items: input, summary: 'sequence not found — skipped', skipped: true }
      let enrolled = 0
      for (const it of input) {
        const email = it.email ? String(it.email) : null
        // Upsert a lead so it can be enrolled
        const lead = await prisma.lead.create({
          data: {
            workspaceId,
            fullName: it.fullName ?? it.name ?? firstName(it) ?? 'Unknown',
            firstName: firstName(it) || null,
            email, company: it.company ?? null, title: it.title ?? null,
            icpScore: it.icpScore ?? null, aiSummary: it.aiSummary ?? null,
          },
        }).catch(() => null)
        if (!lead) continue
        await prisma.sequenceLead.create({ data: { sequenceId, leadId: lead.id } }).catch(() => {})
        enrolled++
      }
      await prisma.sequence.update({ where: { id: sequenceId }, data: { leadCount: { increment: enrolled } } }).catch(() => {})
      return { items: input, summary: `enrolled ${enrolled} lead(s) into sequence` }
    }

    case 'send-webhook': {
      const url = cfg.url
      if (!url) return { items: input, summary: 'no URL configured — skipped', skipped: true }
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(cfg.secret ? { Authorization: cfg.secret } : {}) },
        body: JSON.stringify({ items: input, count: input.length }),
        signal: AbortSignal.timeout(15000),
      }).catch(() => {})
      return { items: input, summary: `POSTed ${input.length} item(s) to webhook` }
    }

    case 'export-csv': {
      const key = `datasets/${workspaceId}/workflow-${Date.now()}/data.json`
      await uploadJSON(key, input)
      await prisma.dataset.create({
        data: {
          workspaceId, name: `${cfg.filename || 'Workflow Export'} - ${new Date().toLocaleDateString()}`,
          itemCount: input.length, sizeBytes: Buffer.byteLength(JSON.stringify(input)), s3Key: key,
        },
      }).catch(() => {})
      return { items: input, summary: `exported ${input.length} item(s) to dataset` }
    }

    case 'notify-slack': {
      const hook = cfg.webhookUrl || cfg.url
      if (!hook) return { items: input, summary: 'Slack webhook URL not configured — skipped', skipped: true }
      await fetch(hook, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `Tudumm workflow: ${input.length} lead(s) processed${cfg.channel ? ` → ${cfg.channel}` : ''}` }),
        signal: AbortSignal.timeout(10000),
      }).catch(() => {})
      return { items: input, summary: `notified Slack (${input.length} leads)` }
    }

    case 'find-email': {
      const hunterKey = process.env.HUNTER_API_KEY
      const apolloKey = process.env.APOLLO_API_KEY
      if (!hunterKey && !apolloKey) {
        return { items: input, summary: 'Find Email: set HUNTER_API_KEY or APOLLO_API_KEY — skipped', skipped: true }
      }
      let found = 0
      const enriched: Item[] = []
      for (const it of input) {
        if (it.email && String(it.email).includes('@')) { enriched.push(it); continue }
        const first = firstName(it)
        const last = (it.lastName || it.fullName?.split(' ').slice(1).join(' ') || '').trim()
        const domain = it.domain || it.companyDomain
          || (it.company ? `${String(it.company).toLowerCase().replace(/[^a-z0-9]/g, '')}.com` : null)
        if (!domain) { enriched.push(it); continue }
        try {
          let email: string | null = null
          if (hunterKey) {
            const params = new URLSearchParams({ domain, first_name: first, last_name: last, api_key: hunterKey })
            const r = await fetch(`https://api.hunter.io/v2/email-finder?${params}`, { signal: AbortSignal.timeout(10000) })
            if (r.ok) {
              const d = await r.json()
              email = d.data?.email ?? null
            }
          }
          if (!email && apolloKey) {
            const r = await fetch('https://api.apollo.io/v1/people/match', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Api-Key': apolloKey },
              body: JSON.stringify({ first_name: first, last_name: last, domain }),
              signal: AbortSignal.timeout(10000),
            })
            if (r.ok) {
              const d = await r.json()
              email = d.person?.email ?? null
            }
          }
          if (email) { enriched.push({ ...it, email }); found++ } else enriched.push(it)
        } catch { enriched.push(it) }
      }
      return { items: enriched, summary: `found ${found} email(s) for ${input.length} lead(s)` }
    }

    case 'apollo-enrich': {
      const apolloKey = process.env.APOLLO_API_KEY
      if (!apolloKey) {
        return { items: input, summary: 'Apollo Enricher: set APOLLO_API_KEY — skipped', skipped: true }
      }
      let enriched2 = 0
      const apolloItems: Item[] = []
      for (const it of input) {
        try {
          const first = firstName(it)
          const last = (it.lastName || it.fullName?.split(' ').slice(1).join(' ') || '').trim()
          const domain = it.domain || it.companyDomain
            || (it.company ? `${String(it.company).toLowerCase().replace(/[^a-z0-9]/g, '')}.com` : null)
          const r = await fetch('https://api.apollo.io/v1/people/match', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Api-Key': apolloKey },
            body: JSON.stringify({ first_name: first, last_name: last, domain, email: it.email }),
            signal: AbortSignal.timeout(10000),
          })
          if (!r.ok) { apolloItems.push(it); continue }
          const d = await r.json()
          const p = d.person ?? {}
          apolloItems.push({
            ...it,
            email: it.email || p.email || null,
            phone: it.phone || p.phone_numbers?.[0]?.sanitized_number || null,
            title: it.title || p.title || null,
            company: it.company || p.organization?.name || null,
            linkedinUrl: it.linkedinUrl || p.linkedin_url || null,
            city: p.city || null,
            country: p.country || null,
            seniority: p.seniority || null,
            apolloId: p.id || null,
          })
          enriched2++
        } catch { apolloItems.push(it) }
      }
      return { items: apolloItems, summary: `Apollo enriched ${enriched2}/${input.length} lead(s)` }
    }

    case 'save-to-crm':
      return { items: input, summary: 'Save to CRM (OAuth) coming soon — skipped', skipped: true }

    case 'schedule-trigger':
    case 'webhook-trigger':
    case 'manual-trigger':
      return { items: input, summary: 'trigger' }

    default:
      return { items: input, summary: `unknown node type "${slug}" — passed through`, skipped: true }
  }
}

export async function runWorkflow(workflowId: string, workspaceId: string, executionId: string): Promise<void> {
  try {
    const workflow = await prisma.workflowDefinition.findFirst({ where: { id: workflowId, workspaceId } })
    if (!workflow) throw new Error('Workflow not found')

    // Defensive parse: heals legacy double-encoded rows (parse yields a string).
    const parseGraph = (raw: unknown): any[] => {
      let v: any = JSON.parse((raw as string) || '[]')
      if (typeof v === 'string') v = JSON.parse(v)
      return Array.isArray(v) ? v : []
    }
    const nodes: any[] = parseGraph(workflow.nodes)
    const edges: any[] = parseGraph(workflow.edges)

    const inDegree: Record<string, number> = {}
    const children: Record<string, string[]> = {}
    const parents: Record<string, string[]> = {}
    for (const node of nodes) { inDegree[node.id] = 0; children[node.id] = []; parents[node.id] = [] }
    for (const edge of edges) {
      inDegree[edge.target] = (inDegree[edge.target] ?? 0) + 1
      children[edge.source] = [...(children[edge.source] ?? []), edge.target]
      parents[edge.target] = [...(parents[edge.target] ?? []), edge.source]
    }

    const bfsQueue: string[] = nodes.filter(n => (inDegree[n.id] ?? 0) === 0).map(n => n.id)
    const order: string[] = []
    while (bfsQueue.length > 0) {
      const nodeId = bfsQueue.shift()!
      order.push(nodeId)
      for (const child of children[nodeId] ?? []) {
        inDegree[child] = (inDegree[child] ?? 1) - 1
        if (inDegree[child] === 0) bfsQueue.push(child)
      }
    }

    const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]))
    const execution = await prisma.workflowExecution.findUnique({ where: { id: executionId } })
    const nodeStates: Record<string, any> = execution?.nodeStates ? JSON.parse(execution.nodeStates as string) : {}
    const nodeOutputs: Record<string, Item[]> = {}

    for (const nodeId of order) {
      const node = nodeMap[nodeId]
      if (!node) continue
      const slug: string = node.data?.slug ?? node.type ?? ''
      const cfg: Record<string, any> = { ...(node.data?.config ?? {}), ...(node.data?.input ?? {}) }

      nodeStates[nodeId] = { ...nodeStates[nodeId], status: 'running', startedAt: new Date().toISOString() }
      await prisma.workflowExecution.update({ where: { id: executionId }, data: { nodeStates: JSON.stringify(nodeStates) } })

      // Gather input items from parents
      const inputItems: Item[] = (parents[nodeId] ?? []).flatMap(p => nodeOutputs[p] ?? [])

      try {
        const { items, summary, skipped } = await executeNode(slug, cfg, inputItems, workspaceId)
        nodeOutputs[nodeId] = items
        nodeStates[nodeId] = {
          ...nodeStates[nodeId],
          status: skipped ? 'skipped' : 'completed',
          summary, itemCount: items.length,
          finishedAt: new Date().toISOString(),
        }
      } catch (err: any) {
        nodeOutputs[nodeId] = inputItems
        nodeStates[nodeId] = { ...nodeStates[nodeId], status: 'failed', summary: String(err?.message ?? err).slice(0, 200), finishedAt: new Date().toISOString() }
      }
      await prisma.workflowExecution.update({ where: { id: executionId }, data: { nodeStates: JSON.stringify(nodeStates) } })
    }

    const anyFailed = Object.values(nodeStates).some((s: any) => s.status === 'failed')
    await prisma.workflowExecution.update({
      where: { id: executionId },
      data: { status: anyFailed ? 'FAILED' : 'COMPLETED', nodeStates: JSON.stringify(nodeStates), finishedAt: new Date() },
    })
    await prisma.workflowDefinition.update({
      where: { id: workflowId }, data: { totalRuns: { increment: 1 }, lastRunAt: new Date() },
    }).catch(() => {})
  } catch (e: any) {
    await prisma.workflowExecution.update({
      where: { id: executionId }, data: { status: 'FAILED', errorMessage: e.message, finishedAt: new Date() },
    }).catch(() => {})
  }
}
