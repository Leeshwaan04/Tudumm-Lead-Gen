import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { parseCsvStream } from '@/lib/csv'

const MAX_RECORDS = 10000

export async function POST(req: Request) {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.workspaceId
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const contentType = req.headers.get('content-type') ?? ''
    const errors: string[] = []
    const records: any[] = []

    if (contentType.includes('application/json')) {
      const body = await req.json()
      const leads: any[] = Array.isArray(body) ? body : (body.leads ?? [])
      for (const row of leads) {
        const rec = buildRecord(workspaceId, row)
        if (rec.error) errors.push(rec.error)
        else if (rec.data) records.push(rec.data)
      }
    } else {
      const formData = await req.formData()
      const file = formData.get('file') as File | null
      if (!file) return NextResponse.json({ error: 'Missing file' }, { status: 400 })
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 413 })
      }
      
      const rows = await parseCsvStream(file)
      if (rows.length === 0) return NextResponse.json({ imported: 0, errors: ['Empty or unparseable CSV'] })

      rows.forEach((rawRow, idx) => {
        // Normalize header keys: lowercase + strip spaces, so camelCase / Title Case
        // headers (fullName, "Full Name", "LinkedIn URL") all map correctly.
        const row: Record<string, string> = {}
        for (const k of Object.keys(rawRow)) {
          row[k.toLowerCase().replace(/\s+/g, '')] = (rawRow as Record<string, string>)[k] ?? ''
        }
        const normalized = {
          fullName: row['fullname'] || row['full_name'] || row['name'] ||
            [row['firstname'] || row['first_name'], row['lastname'] || row['last_name']].filter(Boolean).join(' '),
          firstName: row['firstname'] || row['first_name'],
          lastName: row['lastname'] || row['last_name'],
          email: row['email'],
          company: row['company'],
          title: row['title'],
          linkedinUrl: row['linkedinurl'] || row['linkedin_url'],
        }
        const rec = buildRecord(workspaceId, normalized)
        if (rec.error) errors.push(`Row ${idx + 2}: ${rec.error}`)
        else if (rec.data) records.push(rec.data)
      })
    }

    if (records.length > MAX_RECORDS) {
      return NextResponse.json({ error: `Too many rows (max ${MAX_RECORDS})` }, { status: 413 })
    }

    // Dedup within the batch first (last write wins on duplicate email)
    const byEmail = new Map<string, any>()
    const withoutEmail: any[] = []
    for (const r of records) {
      if (r.email) byEmail.set(r.email.toLowerCase(), { ...r, email: r.email.toLowerCase() })
      else withoutEmail.push(r)
    }
    const deduped = [...byEmail.values(), ...withoutEmail]

    // createMany with skipDuplicates leverages @@unique([workspaceId, email]) to skip existing rows
    const result = await prisma.lead.createMany({
      data: deduped,
      skipDuplicates: true,
    })

    return NextResponse.json({
      imported: result.count,
      skipped: deduped.length - result.count,
      errors,
    })
  } catch (e: any) {
    console.error('[Leads import error]', e)
    return NextResponse.json({ error: 'Import failed' }, { status: 500 })
  }
}

function buildRecord(workspaceId: string, row: any): { data?: any; error?: string } {
  const fullName = row.fullName ?? row.name ?? [row.firstName, row.lastName].filter(Boolean).join(' ')
  if (!fullName) return { error: 'missing name' }
  return {
    data: {
      workspaceId,
      fullName: String(fullName).slice(0, 200),
      firstName: row.firstName ? String(row.firstName).slice(0, 100) : null,
      lastName: row.lastName ? String(row.lastName).slice(0, 100) : null,
      email: row.email ? String(row.email).toLowerCase().slice(0, 200) : null,
      company: row.company ? String(row.company).slice(0, 200) : null,
      title: row.title ? String(row.title).slice(0, 200) : null,
      linkedinUrl: row.linkedinUrl ? String(row.linkedinUrl).slice(0, 500) : null,
    },
  }
}
