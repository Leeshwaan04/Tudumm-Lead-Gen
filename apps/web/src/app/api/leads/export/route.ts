import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function GET(req: Request) {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.workspaceId
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const listId = searchParams.get('listId') ?? undefined
    const format = searchParams.get('format') ?? 'csv'
    const minScore = searchParams.get('minScore') ? parseInt(searchParams.get('minScore')!) : undefined

    const where: any = { workspaceId }
    if (listId) where.listId = listId
    if (minScore !== undefined) where.icpScore = { gte: minScore }

    const leads = await prisma.lead.findMany({ where })

    if (format === 'json') {
      return new NextResponse(JSON.stringify(leads), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': 'attachment; filename="leads.json"',
        },
      })
    }

    // CSV
    const headers = ['fullName', 'email', 'phone', 'company', 'title', 'icpScore', 'linkedinUrl', 'location']
    const rows = leads.map(l =>
      headers.map(h => {
        const val = (l as any)[h] ?? ''
        let str = String(val)
        // Prevent CSV formula injection (Excel/Sheets executes cells starting with =, +, -, @)
        if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`
        return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str
      }).join(',')
    )
    const csv = [headers.join(','), ...rows].join('\n')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="leads.csv"',
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
