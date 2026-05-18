import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export async function POST(req: Request) {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.workspaceId
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Missing file' }, { status: 400 })

    const text = await file.text()
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length < 2) return NextResponse.json({ imported: 0, errors: ['Empty file'] })

    const headerLine = (lines[0] ?? '').split(',').map((h: string) => h.trim().toLowerCase())
    const errors: string[] = []
    const records: any[] = []

    for (let i = 1; i < lines.length; i++) {
      const values = (lines[i] ?? '').split(',').map((v: string) => v.trim())
      const row: Record<string, string> = {}
      headerLine.forEach((h, idx) => { row[h] = values[idx] ?? '' })

      const fullName = row['fullname'] || row['full_name'] || [row['firstname'] || row['first_name'], row['lastname'] || row['last_name']].filter(Boolean).join(' ')
      if (!fullName) { errors.push(`Row ${i}: missing fullName`); continue }

      records.push({
        workspaceId,
        fullName,
        firstName: row['firstname'] || row['first_name'] || undefined,
        lastName: row['lastname'] || row['last_name'] || undefined,
        email: row['email'] || undefined,
        phone: row['phone'] || undefined,
        company: row['company'] || undefined,
        title: row['title'] || undefined,
        linkedinUrl: row['linkedinurl'] || row['linkedin_url'] || undefined,
        location: row['location'] || undefined,
      })
    }

    let imported = 0
    for (const data of records) {
      try {
        await prisma.lead.create({ data })
        imported++
      } catch (e: any) {
        errors.push(`Lead ${data.fullName}: ${e.message}`)
      }
    }

    return NextResponse.json({ imported, errors })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
