import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

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

    // Generate mock items based on itemCount and dataset name
    const count = Math.min(dataset.itemCount, 20)
    const nameLower = dataset.name.toLowerCase()
    const items = Array.from({ length: count }, (_, i) => {
      if (nameLower.includes('linkedin')) {
        return { index: i + 1, fullName: `Person ${i + 1}`, title: 'Software Engineer', company: `Company ${i + 1}`, linkedinUrl: `https://linkedin.com/in/person-${i + 1}`, location: 'San Francisco, CA' }
      } else if (nameLower.includes('google') || nameLower.includes('maps')) {
        return { index: i + 1, name: `Business ${i + 1}`, address: `${100 + i} Main St`, phone: `+1555000${String(i).padStart(4, '0')}`, rating: (3 + Math.random() * 2).toFixed(1), category: 'Services' }
      } else {
        return { index: i + 1, id: `item-${i + 1}`, value: `Value ${i + 1}`, createdAt: new Date().toISOString() }
      }
    })

    return NextResponse.json({ ...dataset, items })
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
    const result = await prisma.dataset.deleteMany({ where: { id, workspaceId } })
    if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
