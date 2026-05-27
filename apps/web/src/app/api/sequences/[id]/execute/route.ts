import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import nodemailer from 'nodemailer'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const workspaceId = (session as any)?.workspaceId
    if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: sequenceId } = await params

    const sequence = await prisma.sequence.findFirst({ where: { id: sequenceId, workspaceId } })
    if (!sequence) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (sequence.status !== 'ACTIVE') return NextResponse.json({ error: 'Sequence is not active' }, { status: 400 })

    const steps: any[] = JSON.parse(sequence.steps ?? '[]')
    if (steps.length === 0) return NextResponse.json({ error: 'No steps configured' }, { status: 400 })

    const now = new Date()
    const pendingLeads = await prisma.sequenceLead.findMany({
      where: {
        sequenceId,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        OR: [{ nextStepAt: null }, { nextStepAt: { lte: now } }],
      },
      include: { lead: true },
      take: 50,
    })

    let processed = 0
    let errors = 0

    for (const sl of pendingLeads) {
      const stepIndex = sl.currentStep ?? 0
      const step = steps[stepIndex]
      if (!step) {
        await prisma.sequenceLead.update({ where: { id: sl.id }, data: { status: 'COMPLETED' } })
        continue
      }

      try {
        const success = await executeStep(step, sl.lead, sequence.platform)
        if (success) {
          const nextStepIndex = stepIndex + 1
          const nextStep = steps[nextStepIndex]
          const nextStepAt = nextStep
            ? new Date(Date.now() + (nextStep.delayDays ?? 1) * 86_400_000)
            : null

          await prisma.sequenceLead.update({
            where: { id: sl.id },
            data: {
              status: nextStepAt ? 'IN_PROGRESS' : 'COMPLETED',
              currentStep: nextStepIndex,
              lastStepAt: now,
              nextStepAt,
            },
          })

          await prisma.leadActivity.create({
            data: {
              leadId: sl.leadId,
              type: sequence.platform === 'linkedin' ? 'linkedin_sent' : 'email_sent',
              note: `Step ${stepIndex + 1}: ${step.subject ?? step.message ?? 'message sent'}`,
            },
          })

          processed++
        }
      } catch (err) {
        console.error(`[Sequence] Step failed for lead ${sl.leadId}:`, err)
        errors++
      }
    }

    await prisma.sequence.update({
      where: { id: sequenceId },
      data: { sentCount: { increment: processed } },
    })

    return NextResponse.json({ processed, errors, total: pendingLeads.length })
  } catch (e: any) {
    console.error('[API Error]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

async function executeStep(step: any, lead: any, platform: string): Promise<boolean> {
  if (platform === 'EMAIL' || platform === 'MIXED') {
    return sendEmail(step, lead)
  }
  // LinkedIn: log the action (real automation requires browser session + cookie)
  console.log(`[Sequence][LinkedIn] ${lead.email ?? lead.fullName}: ${step.message ?? ''}`)
  return true
}

async function sendEmail(step: any, lead: any): Promise<boolean> {
  if (!lead.email) return false

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'localhost',
    port: parseInt(process.env.SMTP_PORT ?? '1025'),
    secure: process.env.SMTP_PORT === '465',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
    ignoreTLS: !process.env.SMTP_USER,
  } as any)

  const subject = interpolate(step.subject ?? 'Following up', lead)
  const body = interpolate(step.message ?? step.body ?? '', lead)

  await transporter.sendMail({
    from: process.env.EMAIL_FROM ?? 'noreply@tudumm.io',
    to: lead.email,
    subject,
    text: body,
    html: `<p>${body.replace(/\n/g, '<br>')}</p>`,
  })
  return true
}

function interpolate(template: string, lead: any): string {
  return template
    .replace(/\{\{firstName\}\}/g, lead.firstName ?? lead.fullName?.split(' ')[0] ?? '')
    .replace(/\{\{lastName\}\}/g, lead.lastName ?? '')
    .replace(/\{\{fullName\}\}/g, lead.fullName ?? '')
    .replace(/\{\{company\}\}/g, lead.company ?? '')
    .replace(/\{\{title\}\}/g, lead.title ?? '')
}
