import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { getStorageClient, STORAGE_BUCKET } from '@/lib/storage'

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

    // Fetch real items from MinIO/S3 if available
    let items: any[] = []
    if (dataset.s3Key) {
      try {
        const minio = getStorageClient()
        const stream = await minio.getObject(STORAGE_BUCKET, dataset.s3Key)
        const chunks: Buffer[] = []
        for await (const chunk of stream) chunks.push(Buffer.from(chunk))
        items = JSON.parse(Buffer.concat(chunks).toString('utf-8'))
      } catch {
        items = []
      }
    }

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
      if (items.length === 0) {
        return new NextResponse('', {
          headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="${filename}.csv"` },
        })
      }
      const headers = Object.keys(items[0])
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

    return new NextResponse(JSON.stringify(items, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}.json"`,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
