import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { getStorageClient, STORAGE_BUCKET } from '@/lib/storage'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.workspaceId
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const dataset = await prisma.dataset.findFirst({
      where: { id, workspaceId },
      include: { run: { include: { actor: true } } },
    })
    if (!dataset) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Try to fetch real items from MinIO/S3 if an s3Key is set
    let items: any[] = []
    if (dataset.s3Key) {
      try {
        const minio = getStorageClient()
        const stream = await minio.getObject(STORAGE_BUCKET, dataset.s3Key)
        const chunks: Buffer[] = []
        for await (const chunk of stream) chunks.push(Buffer.from(chunk))
        const raw = Buffer.concat(chunks).toString('utf-8')
        items = JSON.parse(raw)
      } catch {
        // Fallback: return empty items — S3 not available in local dev
        items = []
      }
    }

    return NextResponse.json({ ...dataset, items, itemCount: items.length || dataset.itemCount })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.workspaceId
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const dataset = await prisma.dataset.findFirst({ where: { id, workspaceId } })
    if (!dataset) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Delete from MinIO if stored
    if (dataset.s3Key) {
      try {
        const minio = getStorageClient()
        await minio.removeObject(STORAGE_BUCKET, dataset.s3Key)
      } catch {}
    }

    await prisma.dataset.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
