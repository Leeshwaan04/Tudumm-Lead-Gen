import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

// GET /api/notifications — a lightweight feed of recent workspace events
// (actor runs finishing, lead replies). No separate Notification table needed;
// we derive it from Runs + LeadActivity.
export async function GET() {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [runs, replies] = await Promise.all([
    prisma.run.findMany({
      where: { workspaceId, status: { in: ['SUCCEEDED', 'FAILED'] } },
      orderBy: { finishedAt: 'desc' },
      take: 8,
      include: { actor: { select: { name: true } } },
    }),
    prisma.leadActivity.findMany({
      where: { type: 'reply', lead: { workspaceId } },
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { lead: { select: { fullName: true } } },
    }),
  ])

  type Item = { id: string; kind: string; title: string; detail: string; at: string; href: string; ok: boolean }
  const items: Item[] = []

  for (const r of runs) {
    const ok = r.status === 'SUCCEEDED'
    items.push({
      id: `run-${r.id}`,
      kind: 'run',
      title: ok ? `${r.actor?.name ?? 'Actor'} run finished` : `${r.actor?.name ?? 'Actor'} run failed`,
      detail: ok ? 'Results are ready in Datasets.' : (r.errorMessage ?? 'Run failed').slice(0, 80),
      at: (r.finishedAt ?? r.createdAt).toISOString(),
      href: '/actors',
      ok,
    })
  }
  for (const a of replies) {
    items.push({
      id: `act-${a.id}`,
      kind: 'reply',
      title: `New reply from ${a.lead?.fullName ?? 'a lead'}`,
      detail: (a.note ?? '').slice(0, 80),
      at: a.createdAt.toISOString(),
      href: '/inbox',
      ok: true,
    })
  }

  items.sort((x, y) => +new Date(y.at) - +new Date(x.at))
  return NextResponse.json({ items: items.slice(0, 12), count: items.length })
}
