export type RunStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'TIMEOUT'

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

export interface Run {
  id: string
  workspaceId: string
  actorId: string
  actorVersion: string
  status: RunStatus
  input: Record<string, unknown>
  output?: Record<string, unknown>
  exitCode?: number
  errorMessage?: string
  startedAt?: string
  finishedAt?: string
  durationMs?: number
  memoryMb?: number
  creditsCost?: number
  createdAt: string
}

export interface RunLog {
  id: string
  runId: string
  timestamp: string
  level: LogLevel
  message: string
}
