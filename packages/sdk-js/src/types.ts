export type RunStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'TIMEOUT'
export type ActorStatus = 'DRAFT' | 'PUBLISHED' | 'DEPRECATED'
export type ProxyType = 'RESIDENTIAL' | 'DATACENTER' | 'ISP' | 'MOBILE'

export interface Actor {
  id: string
  name: string
  slug: string
  description: string
  categories: string[]
  tags: string[]
  isPublic: boolean
  status: ActorStatus
  rating: number
  totalRuns: number
  createdAt: string
  updatedAt: string
}

export interface Run {
  id: string
  actorId: string
  workspaceId: string
  status: RunStatus
  input: Record<string, unknown>
  output: Record<string, unknown> | null
  exitCode: number | null
  errorMessage: string | null
  startedAt: string | null
  finishedAt: string | null
  durationMs: number | null
  creditsCost: number
  createdAt: string
}

export interface RunLog {
  id: string
  runId: string
  timestamp: string
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'
  message: string
}

export interface Dataset {
  id: string
  workspaceId: string
  name: string
  itemCount: number
  sizeBytes: number
  createdAt: string
}

export interface ProxyPoolStats {
  type: ProxyType
  count: number
  avgSuccessRate: number
  avgLatencyMs: number
  availableCountries: string[]
}

export interface ApiResponse<T> {
  data: T
  error?: string
  meta?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface TudummClientConfig {
  apiKey: string
  baseUrl?: string
  timeout?: number
}

export interface RunOptions {
  waitForFinish?: boolean
  timeoutSecs?: number
  memory?: number
  build?: string
}

export interface ListActorsOptions {
  search?: string
  category?: string
  page?: number
  limit?: number
  myActors?: boolean
}

export interface PaginatedItems<T> {
  data: T[]
  total: number
  page: number
  limit: number
}
