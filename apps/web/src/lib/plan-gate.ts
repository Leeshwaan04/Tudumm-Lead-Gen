import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'

export class InsufficientCreditsError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InsufficientCreditsError'
  }
}

export type CreditType = 'creditBalance' | 'aiCredits' | 'emailCredits'

/**
 * Ensures the workspace has at least `amount` of `creditType`.
 * If it does, atomically deducts the amount and creates a transaction record.
 */
export async function requireCredits(
  workspaceId: string,
  amount: number,
  type: CreditType,
  description: string
): Promise<void> {
  if (amount <= 0) return

  // Use a transaction to ensure safe deduction
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Lock the workspace row for update
    const workspace: any = await tx.$queryRaw`
      SELECT id, "creditBalance", "aiCredits", "emailCredits"
      FROM workspaces
      WHERE id = ${workspaceId}
      FOR UPDATE
    `
    
    if (!workspace || workspace.length === 0) {
      throw new Error('Workspace not found')
    }

    const currentBalance = workspace[0][type]

    if (currentBalance < amount) {
      throw new InsufficientCreditsError(
        `Insufficient ${type}. Required: ${amount}, Available: ${currentBalance}`
      )
    }

    // Deduct the credits
    const updateData = { [type]: { decrement: amount } }
    
    await tx.workspace.update({
      where: { id: workspaceId },
      data: updateData
    })

    // Record the transaction
    await tx.creditTransaction.create({
      data: {
        workspaceId,
        type,
        amount: -amount,
        balanceBefore: currentBalance,
        balanceAfter: currentBalance - amount,
        description
      }
    })
  })
}

/**
 * Refunds previously deducted credits, typically on failure.
 */
export async function refundCredits(
  workspaceId: string,
  amount: number,
  type: CreditType,
  description: string
): Promise<void> {
  if (amount <= 0) return

  await prisma.$transaction(async (tx) => {
    const workspace: any = await tx.$queryRaw`
      SELECT id, "creditBalance", "aiCredits", "emailCredits"
      FROM workspaces
      WHERE id = ${workspaceId}
      FOR UPDATE
    `
    if (!workspace || workspace.length === 0) return

    const currentBalance = workspace[0][type]

    // Refund
    const updateData = { [type]: { increment: amount } }
    
    await tx.workspace.update({
      where: { id: workspaceId },
      data: updateData
    })

    await tx.creditTransaction.create({
      data: {
        workspaceId,
        type,
        amount,
        balanceBefore: currentBalance,
        balanceAfter: currentBalance + amount,
        description
      }
    })
  })
}
