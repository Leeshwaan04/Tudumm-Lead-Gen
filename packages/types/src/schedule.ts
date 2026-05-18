import type { RunStatus } from './run'

export type TriggerType = 'CRON' | 'WEBHOOK' | 'ACTOR_COMPLETION' | 'MANUAL'

export type ScheduleStatus = 'ACTIVE' | 'PAUSED' | 'DELETED'

export interface Schedule {
  id: string
  workspaceId: string
  actorId: string
  name: string
  cronExpr?: string
  timezone: string
  triggerType: TriggerType
  status: ScheduleStatus
  input: Record<string, unknown>
  nextRunAt?: string
  lastRunAt?: string
  lastRunStatus?: RunStatus
  createdAt: string
}
