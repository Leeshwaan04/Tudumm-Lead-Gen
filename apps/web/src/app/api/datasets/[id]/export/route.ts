import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.workspaceId
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const dataset = await prisma.dataset.findFirst({ where: { id, workspaceId } })
    if (!dataset) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { searchParams } = new URL(req.url)
    const format = searchParams.get('format') ?? 'json'

    const count = Math.min(dataset.itemCount, 100)
    const nameLower = dataset.name.toLowerCase()

    const items = Array.from({ length: count }, (_, i) => {
      if (nameLower.includes('linkedin')) {
        return { fullName: `Person ${i + 1}`, title: 'Software Engineer', company: `Company ${i + 1}`, linkedinUrl: `https://linkedin.com/in/person-${i + 1}`, location: 'San Francisco, CA', connections: 500 + i }
      } else if (nameLower.includes('google') || nameLower.includes('maps')) {
        return { name: `Business ${i + 1}`, address: `${100 + i} Main St`, phone: `+1555000${String(i).padStart(4, '0')}`, rating: (3 + (i % 20) / 10).toFixed(1), category: 'Services', website: `https://business${i + 1}.com` }
      } else {
        return { id: `item-${i + 1}`, value: `Value ${i + 1}`, score: i * 10, createdAt: new Date().toISOString() }
      }
    })

    const filename = `${dataset.name.replace(/\s+/g, '-')}-export`

    if (format === 'ndjson') {
      const ndjson = items.map(r => JSON.stringify(r)).join('\n')
      return new NextResponse(ndjson, {
        headers: {
          'Content-Type': 'application/x-ndjson',
          'Content-Disposition': `attachment; filename="${filename}.ndjson"`,
        },
      })
    }

    if (format === 'csv') {
      if (items.length === 0) return new NextResponse('', { headers: { 'Content-Type': 'text/csv' } })
      const headers = Object.keys(items[0] ?? {})
      const rows = items.map(item =>
        headers.map(h => {
          const val = String((item as any)[h] ?? '')
          return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val
        }).join(',')
      )
      const csv = [headers.join(','), ...rows].join('\n')
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}.csv"`,
        },
      })
    }

    // JSON default
    return new NextResponse(JSON.stringify(items), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}.json"`,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
