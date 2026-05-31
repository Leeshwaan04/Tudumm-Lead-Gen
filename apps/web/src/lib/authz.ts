// Authorization helpers for API routes.
// Role hierarchy: OWNER > ADMIN > MEMBER > VIEWER

import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export type Role = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'

const ROLE_RANK: Record<Role, number> = {
  OWNER: 4,
  ADMIN: 3,
  MEMBER: 2,
  VIEWER: 1,
}

export interface AuthorizedSession {
  userId: string
  workspaceId: string
  role: Role
}

/**
 * Resolve the caller's session + workspace role. Returns NextResponse on failure.
 * Usage:
 *   const ctx = await requireRole('MEMBER')
 *   if (ctx instanceof NextResponse) return ctx
 *   // use ctx.workspaceId, ctx.userId, ctx.role
 */
export async function requireRole(min: Role = 'MEMBER'): Promise<AuthorizedSession | NextResponse> {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  const userId = session?.user?.id
  if (!workspaceId || !userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  })
  if (!member) {
    return NextResponse.json({ error: 'Not a workspace member' }, { status: 403 })
  }

  const role = (member.role as Role) ?? 'MEMBER'
  if (ROLE_RANK[role] < ROLE_RANK[min]) {
    return NextResponse.json(
      { error: `${min} role required (you are ${role})` },
      { status: 403 }
    )
  }

  return { userId, workspaceId, role }
}

/** Shorthand: only OWNER. */
export const requireOwner = () => requireRole('OWNER')
/** Shorthand: OWNER or ADMIN. */
export const requireAdmin = () => requireRole('ADMIN')
/** Shorthand: anyone in the workspace except VIEWER. */
export const requireMember = () => requireRole('MEMBER')
