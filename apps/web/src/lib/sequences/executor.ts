import { prisma } from '@/lib/db'
import { sendMail } from '@/lib/mailer'
import { randomUUID } from 'crypto'
import { parseSequenceSteps, SequenceStepError } from '@/lib/sequence-steps'
import { interpolate, wrapHtmlEmail, unsubscribeUrl } from '@/lib/email'
import { sendLinkedInConnection, sendLinkedInMessage, BrowserClientError } from '@/lib/browser-client'
import { decryptCookie } from '@/lib/cookie-cipher'
import { requireCredits, refundCredits } from '@/lib/plan-gate'

const LINKEDIN_SEND_ENABLED = process.env.LINKEDIN_SEND_ENABLED !== 'false'
const BATCH_SIZE = 50

export async function processSequenceBatch(sequenceId: string, workspaceId: string) {
  const sequence = await prisma.sequence.findFirst({ where: { id: sequenceId, workspaceId } })
  if (!sequence) throw new Error('Not found')
  if (sequence.status !== 'ACTIVE') throw new Error('Sequence is not active')

  if (sequence.platform === 'linkedin' || sequence.platform === 'LINKEDIN') {
    if (!LINKEDIN_SEND_ENABLED) {
      throw new Error('LinkedIn sending is disabled via feature flag')
    }
  }

  const steps = parseSequenceSteps(sequence.steps)

  const workerToken = randomUUID()
  const now = new Date()
  const staleBefore = new Date(now.getTime() - 10 * 60_000)

  await prisma.$executeRaw`
    UPDATE sequence_leads
    SET "claimedAt" = ${now}, "claimedBy" = ${workerToken}
    WHERE id IN (
      SELECT id FROM sequence_leads
      WHERE "sequenceId" = ${sequenceId}
        AND status IN ('PENDING', 'IN_PROGRESS')
        AND ("nextStepAt" IS NULL OR "nextStepAt" <= ${now})
        AND ("claimedAt" IS NULL OR "claimedAt" < ${staleBefore})
      ORDER BY "nextStepAt" ASC NULLS FIRST
      LIMIT ${BATCH_SIZE}
      FOR UPDATE SKIP LOCKED
    )
  `

  const claimedLeads = await prisma.sequenceLead.findMany({
    where: { sequenceId, claimedBy: workerToken },
    include: { lead: true },
  })

  if (claimedLeads.length === 0) {
    return { processed: 0, errors: 0, total: 0 }
  }

  // Reserve credits for the batch. Email consumes emailCredits, LinkedIn consumes creditBalance.
  const creditType = sequence.platform === 'EMAIL' || sequence.platform === 'email' ? 'emailCredits' : 'creditBalance'
  
  try {
    await requireCredits(workspaceId, claimedLeads.length, creditType, `Sequence ${sequenceId} batch execution`)
  } catch (err: any) {
    // Insufficient credits — release all claims and abort
    await prisma.sequenceLead.updateMany({
      where: { sequenceId, claimedBy: workerToken },
      data: { claimedAt: null, claimedBy: null }
    })
    throw err
  }

  let processed = 0
  let errors = 0
  let skipped = 0

  for (const sl of claimedLeads) {
    const stepIndex = sl.currentStep ?? 0
    const step = steps[stepIndex]

      // Past the last step → complete and release lease
      if (!step) {
        await prisma.sequenceLead.update({
          where: { id: sl.id },
          data: { status: 'COMPLETED', claimedAt: null, claimedBy: null },
        })
        skipped++
        continue
      }

      // Skip leads with no email (for email platform) or unsubscribed
      if ((sl.lead as any).unsubscribedAt) {
        await prisma.sequenceLead.update({
          where: { id: sl.id },
          data: { status: 'COMPLETED', claimedAt: null, claimedBy: null },
        })
        skipped++
        continue
      }

    try {
      const success = await executeStep(step, sl.lead, sequence)

      if (success) {
        const nextStepIndex = stepIndex + 1
        const nextStep = steps[nextStepIndex]
        const nextStepAt = nextStep
          ? new Date(Date.now() + (nextStep.delayDays ?? 1) * 86_400_000)
          : null

        await prisma.$transaction([
          prisma.sequenceLead.update({
            where: { id: sl.id },
            data: {
              status: nextStepAt ? 'IN_PROGRESS' : 'COMPLETED',
              currentStep: nextStepIndex,
              lastStepAt: now,
              nextStepAt,
              claimedAt: null,
              claimedBy: null,
            },
          }),
          prisma.leadActivity.create({
            data: {
              leadId: sl.leadId,
              type: sequence.platform === 'linkedin' ? 'linkedin_sent' : 'email_sent',
              note: `Step ${stepIndex + 1}: ${step.subject ?? step.message ?? 'message sent'}`,
            },
          }),
          prisma.sequence.update({
            where: { id: sequenceId },
            data: { sentCount: { increment: 1 } },
          }),
        ])

        processed++
      } else {
        await prisma.sequenceLead.update({
          where: { id: sl.id },
          data: { status: 'FAILED', claimedAt: null, claimedBy: null },
        })
        errors++
      }
    } catch (err) {
      console.error(`[Sequence] Step failed for lead ${sl.leadId}:`, err)
      await prisma.sequenceLead.update({
        where: { id: sl.id },
        data: { claimedAt: null, claimedBy: null },
      })
      errors++
    }
  }

  const failedOrSkipped = errors + skipped
  if (failedOrSkipped > 0) {
    await refundCredits(workspaceId, failedOrSkipped, creditType, `Refund ${failedOrSkipped} skipped/failed sequence leads`)
  }

  return { processed, errors, total: claimedLeads.length }
}

async function executeStep(step: any, lead: any, sequence: any): Promise<boolean> {
  const platform = sequence.platform
  if (platform === 'EMAIL' || platform === 'MIXED' || platform === 'email') {
    return sendEmail(step, lead)
  }
  if (!LINKEDIN_SEND_ENABLED) {
    throw new Error('LinkedIn send is disabled via feature flag')
  }
  
  if (!lead.linkedinUrl) {
    return false // Skip if no LinkedIn URL
  }

  const session = await prisma.linkedInSession.findFirst({
    where: { workspaceId: sequence.workspaceId, status: 'ACTIVE' },
    orderBy: { lastUsedAt: 'asc' }
  })

  if (!session) {
    throw new Error('No active LinkedIn session available for this workspace')
  }

  // Enforce daily limit for LinkedIn sends
  if (session.dailyUsed >= session.dailyLimit) {
    throw new Error('LinkedIn session reached its daily limit')
  }

  // Decrypt the stored cookie. Sessions encrypted under a different/old
  // COOKIE_CIPHER_KEY will fail the AES-GCM auth check — mark them EXPIRED so
  // they stop being retried every tick and the user is prompted to re-auth.
  let rawCookie: string
  try {
    rawCookie = decryptCookie(session.sessionCookie)
  } catch {
    await prisma.linkedInSession.update({
      where: { id: session.id },
      data: { status: 'EXPIRED' },
    })
    throw new Error('LinkedIn session could not be decrypted (re-authentication required)')
  }

  try {
    if (step.type === 'CONNECTION_REQUEST') {
      await sendLinkedInConnection(
        sequence.workspaceId, 
        session.alias, 
        lead.linkedinUrl, 
        rawCookie, 
        interpolate(step.message ?? '', lead)
      )
    } else {
      await sendLinkedInMessage(
        sequence.workspaceId, 
        session.alias, 
        lead.linkedinUrl, 
        rawCookie, 
        interpolate(step.message ?? '', lead)
      )
    }

    await prisma.linkedInSession.update({
      where: { id: session.id },
      data: { 
        lastUsedAt: new Date(),
        dailyUsed: { increment: 1 }
      }
    })

    return true
  } catch (err: any) {
    if (err instanceof BrowserClientError && err.status === 401) {
      await prisma.linkedInSession.update({
        where: { id: session.id },
        data: { status: 'EXPIRED' }
      })
      throw new Error('LinkedIn session expired')
    }
    throw err
  }
}

async function sendEmail(step: any, lead: any): Promise<boolean> {
  if (!lead.email) return false

  const subject = interpolate(step.subject ?? 'Following up', lead)
  const textBody = interpolate(step.message ?? step.body ?? '', lead)
  const unsubUrl = unsubscribeUrl(lead.id)

  await sendMail({
    to: lead.email,
    subject,
    text: `${textBody}\n\n---\nUnsubscribe: ${unsubUrl}`,
    html: wrapHtmlEmail(textBody, lead, unsubUrl),
    headers: {
      'List-Unsubscribe': `<${unsubUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  })
  return true
}
