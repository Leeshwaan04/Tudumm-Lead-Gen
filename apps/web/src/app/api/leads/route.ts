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
    const icpFilter = searchParams.get('icpFilter')
    const emailFilter = searchParams.get('emailFilter')
    const rawLimit = parseInt(searchParams.get('limit') ?? '50', 10)
    const limit = isNaN(rawLimit) ? 50 : Math.min(Math.max(rawLimit, 1), 500)
    const rawOffset = parseInt(searchParams.get('offset') ?? '0', 10)
    const offset = isNaN(rawOffset) ? 0 : Math.max(rawOffset, 0)

    const where: any = { workspaceId, deletedAt: null }
    const andConditions: any[] = []

    if (listId) where.listId = listId
    if (icpFilter && icpFilter !== 'all') {
      if (icpFilter === '80+') where.icpScore = { gte: 80 }
      else if (icpFilter === '60-79') where.icpScore = { gte: 60, lt: 80 }
      else if (icpFilter === 'below60') where.icpScore = { lt: 60 }
    }
    if (emailFilter && emailFilter !== 'all') {
      if (emailFilter === 'NOT_FOUND') {
        andConditions.push({ OR: [{ emailStatus: 'NOT_FOUND' }, { emailStatus: null }] })
      } else {
        where.emailStatus = emailFilter
      }
    }
    if (search) {
      andConditions.push({
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { company: { contains: search, mode: 'insensitive' } },
        ]
      })
    }
    
    if (andConditions.length > 0) {
      where.AND = andConditions
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: [{ icpScore: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
      }),
      prisma.lead.count({ where })
    ])

    return NextResponse.json({ leads, total })
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
