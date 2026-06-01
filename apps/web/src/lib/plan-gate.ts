// Tudumm is free for all users — credit gating is disabled.
// These functions are intentional no-ops so callers keep working without
// deducting or requiring any credits. The InsufficientCreditsError export is
// retained for type compatibility with existing imports/catch blocks.

export class InsufficientCreditsError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InsufficientCreditsError'
  }
}

export type CreditType = 'creditBalance' | 'aiCredits' | 'emailCredits'

/**
 * No-op: the platform is free, so no credits are ever required or deducted.
 */
export async function requireCredits(
  _workspaceId: string,
  _amount: number,
  _type: CreditType,
  _description: string
): Promise<void> {
  return
}

/**
 * No-op: nothing was deducted, so nothing to refund.
 */
export async function refundCredits(
  _workspaceId: string,
  _amount: number,
  _type: CreditType,
  _description: string
): Promise<void> {
  return
}
