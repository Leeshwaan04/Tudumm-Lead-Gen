import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const configs = await prisma.proxyConfig.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
  })

  const parsed = configs.map(({ credentials, ...c }) => ({
    ...c,
    credentialsSet: true,
  }))

  // Aggregate usage stats
  const totalRequests = configs.reduce((sum, c) => sum + c.requestCount, 0)
  const residential = configs.filter((c) => c.type === 'RESIDENTIAL').reduce((sum, c) => sum + c.requestCount, 0)
  const datacenter = configs.filter((c) => c.type === 'DATACENTER').reduce((sum, c) => sum + c.requestCount, 0)
  const countries = [...new Set(configs.map((c) => c.country).filter(Boolean))] as string[]

  return NextResponse.json({
    configs: parsed,
    stats: { totalRequests, residential, datacenter, countries },
  })
}

export async function POST(req: Request) {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const name = body.name ?? body.label
  const { type, country, provider, credentials } = body
  if (!name || !type) return NextResponse.json({ error: 'name and type are required' }, { status: 400 })

  const config = await prisma.proxyConfig.create({
    data: {
      workspaceId,
      name,
      type,
      country: country ?? null,
      provider: provider ?? 'internal',
      credentials: JSON.stringify(credentials ?? {}),
    },
  })

  const { credentials: _creds, ...configWithout } = config
  return NextResponse.json({ ...configWithout, credentialsSet: true }, { status: 201 })
}
