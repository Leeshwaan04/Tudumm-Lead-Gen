import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET(req: Request) {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const listId = searchParams.get('listId')
  const search = searchParams.get('search')
  const minScore = searchParams.get('minScore')
  const limit = parseInt(searchParams.get('limit') ?? '100', 10)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)

  const where: any = { workspaceId }
  if (listId) where.listId = listId
  if (minScore) where.icpScore = { gte: parseInt(minScore, 10) }
  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { company: { contains: search, mode: 'insensitive' } },
    ]
  }

  const leads = await prisma.lead.findMany({
    where,
    orderBy: [{ icpScore: 'desc' }, { createdAt: 'desc' }],
    take: limit,
    skip: offset,
  })

  return NextResponse.json(leads)
}

export async function POST(req: Request) {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { fullName, firstName, lastName, title, company, email, linkedinUrl, twitterUrl, listId, icpScore, source } = body

  if (!fullName) return NextResponse.json({ error: 'fullName is required' }, { status: 400 })

  const lead = await prisma.lead.create({
    data: {
      workspaceId,
      fullName,
      firstName: firstName ?? null,
      lastName: lastName ?? null,
      title: title ?? null,
      company: company ?? null,
      email: email ?? null,
      linkedinUrl: linkedinUrl ?? null,
      twitterUrl: twitterUrl ?? null,
      listId: listId ?? null,
      icpScore: icpScore ?? null,
      source: source ?? null,
    },
  })

  return NextResponse.json(lead, { status: 201 })
}
