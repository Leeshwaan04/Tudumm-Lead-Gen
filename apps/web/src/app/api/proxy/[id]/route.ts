import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.workspaceId
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const config = await prisma.proxyConfig.findFirst({ where: { id, workspaceId } })
    if (!config) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { credentials, ...configWithout } = config
    return NextResponse.json({ ...configWithout, credentialsSet: !!credentials })
  } catch (e) {
    console.error('[API Error]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.workspaceId
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()

    const data: any = {}
    if (body.isActive !== undefined) data.isActive = body.isActive
    if (body.name !== undefined) data.name = body.name
    if (body.country !== undefined) data.country = body.country
    if (body.provider !== undefined) data.provider = body.provider
    if (body.credentials !== undefined) data.credentials = JSON.stringify(body.credentials)

    const result = await prisma.proxyConfig.updateMany({ where: { id, workspaceId }, data })
    if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const updated = await prisma.proxyConfig.findUnique({ where: { id } })
    const { credentials, ...updatedWithout } = updated!
    return NextResponse.json({ ...updatedWithout, credentialsSet: !!credentials })
  } catch (e) {
    console.error('[API Error]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.workspaceId
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const result = await prisma.proxyConfig.deleteMany({ where: { id, workspaceId } })
    if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[API Error]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
