// Validates and normalizes a Sequence.steps JSON array.
// Throws SequenceStepError with a user-readable message on invalid input.

export interface SequenceStep {
  type?: 'email' | 'linkedin_connect' | 'linkedin_message'
  subject?: string
  message?: string
  body?: string
  delayDays?: number
}

export class SequenceStepError extends Error {}

// Lenient read-side parser: always returns an array (handles single- or
// double-encoded JSON, null, or garbage) so a malformed row never 500s or
// crashes the UI.
export function safeParseSteps(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try {
      let p: unknown = JSON.parse(raw)
      if (typeof p === 'string') p = JSON.parse(p) // heal double-encoding
      return Array.isArray(p) ? p : []
    } catch {
      return []
    }
  }
  return []
}

const MAX_STEPS = 20
const MAX_SUBJECT = 200
const MAX_MESSAGE = 5000
const MAX_DELAY_DAYS = 90

export function parseSequenceSteps(raw: unknown): SequenceStep[] {
  let arr: unknown
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw)
    } catch {
      throw new SequenceStepError('steps must be valid JSON')
    }
  } else {
    arr = raw
  }
  if (!Array.isArray(arr)) throw new SequenceStepError('steps must be an array')
  if (arr.length === 0) throw new SequenceStepError('at least one step is required')
  if (arr.length > MAX_STEPS) throw new SequenceStepError(`maximum ${MAX_STEPS} steps allowed`)

  return arr.map((step, i) => {
    if (typeof step !== 'object' || step === null) {
      throw new SequenceStepError(`step ${i + 1} must be an object`)
    }
    const s = step as Record<string, unknown>

    const subject = typeof s.subject === 'string' ? s.subject.slice(0, MAX_SUBJECT) : undefined
    const messageRaw = (typeof s.message === 'string' ? s.message : typeof s.body === 'string' ? s.body : '')
    const message = messageRaw.slice(0, MAX_MESSAGE)
    if (!message) throw new SequenceStepError(`step ${i + 1} requires a message`)

    let delayDays = 0
    if (s.delayDays != null) {
      const d = Number(s.delayDays)
      if (!Number.isFinite(d) || d < 0) throw new SequenceStepError(`step ${i + 1} delayDays must be >= 0`)
      if (d > MAX_DELAY_DAYS) throw new SequenceStepError(`step ${i + 1} delayDays exceeds ${MAX_DELAY_DAYS}`)
      delayDays = d
    }

    return { type: s.type as SequenceStep['type'], subject, message, delayDays }
  })
}
