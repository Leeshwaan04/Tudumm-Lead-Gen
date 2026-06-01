import { CronExpressionParser } from 'cron-parser'

/**
 * Compute the next run time for a cron expression in the given timezone.
 * Returns null if the expression is invalid.
 */
export function nextRunAt(cronExpr: string, timezone = 'UTC', from: Date = new Date()): Date | null {
  try {
    const interval = CronExpressionParser.parse(cronExpr, { currentDate: from, tz: timezone })
    return interval.next().toDate()
  } catch {
    return null
  }
}

export function isValidCron(cronExpr: string): boolean {
  try {
    CronExpressionParser.parse(cronExpr)
    return true
  } catch {
    return false
  }
}
