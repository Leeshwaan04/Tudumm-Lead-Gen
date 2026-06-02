import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(req: Request) {
  // Ensure it's called internally or via a cron scheduler with a secret
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  try {
    const result = await prisma.linkedInSession.updateMany({
      where: { dailyUsed: { gt: 0 } },
      data: { dailyUsed: 0 }
    })
    
    return NextResponse.json({ success: true, count: result.count })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
