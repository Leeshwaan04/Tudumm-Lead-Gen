export type PlanType = 'STARTER' | 'GROW' | 'SCALE' | 'ENTERPRISE'

export type MemberRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'

export interface CreditBreakdown {
  compute: number
  proxyGb: number
  aiCredits: number
  emailCredits: number
  captchaCredits: number
}

export interface CreditBalance {
  total: number
  used: number
  remaining: number
  breakdown: CreditBreakdown
}

export interface Workspace {
  id: string
  name: string
  slug: string
  plan: PlanType
  creditBalance: number
  execHoursUsed: number
  execHoursLimit: number
  slots: number
  slotsUsed: number
  createdAt: string
}

export interface WorkspaceMember {
  id: string
  workspaceId: string
  userId: string
  role: MemberRole
  user: {
    id: string
    name: string
    email: string
    avatarUrl?: string
  }
  joinedAt: string
}
