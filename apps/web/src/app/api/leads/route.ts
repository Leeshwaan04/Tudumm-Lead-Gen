import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET(req: Request) {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.workspaceId
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const listId = searchParams.get('listId')
    const search = searchParams.get('search')
    const minScore = searchParams.get('minScore')
    const rawLimit = parseInt(searchParams.get('limit') ?? '50', 10)
    const limit = isNaN(rawLimit) ? 50 : Math.min(Math.max(rawLimit, 1), 500)
    const rawOffset = parseInt(searchParams.get('offset') ?? '0', 10)
    const offset = isNaN(rawOffset) ? 0 : Math.max(rawOffset, 0)

    const where: any = { workspaceId }
    if (listId) where.listId = listId
    if (minScore) where.icpScore = { gte: parseInt(minScore, 10) }
    if (search) {
      // SQLite does not support mode:'insensitive' — use plain contains (case-sensitive)
      where.OR = [
        { fullName: { contains: search } },
        { email: { contains: search } },
        { company: { contains: search } },
      ]
    }

    const leads = await prisma.lead.findMany({
      where,
      orderBy: [{ icpScore: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      skip: offset,
    })

    return NextResponse.json(leads)
  } catch (e) {
    console.error('[API Error]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.workspaceId
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    // Accept both `fullName` and `name` (frontend may send either)
    const fullName = body.fullName ?? body.name
    const { firstName, lastName, title, company, email, linkedinUrl, twitterUrl, listId, icpScore, source } = body

    if (!fullName) return NextResponse.json({ error: 'name is required' }, { status: 400 })

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
  } catch (e) {
    console.error('[API Error]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
