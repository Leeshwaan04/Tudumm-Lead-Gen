import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  trustHost: true,
  session: { strategy: 'jwt' },
  pages: { signIn: '/login', error: '/error' },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.workspaceId = (user as any).workspaceId
      }
      // Active-workspace switch: client calls useSession().update({ workspaceId }).
      // Validate membership server-side before honoring it (tenant isolation).
      if (trigger === 'update' && session?.workspaceId && token.id) {
        const member = await prisma.workspaceMember.findFirst({
          where: { userId: token.id as string, workspaceId: session.workspaceId },
        })
        if (member) token.workspaceId = session.workspaceId
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.id as string
      ;(session as any).workspaceId = token.workspaceId
      return session
    },
  },
  providers: [
    Credentials({
      credentials: { email: { type: 'email' }, password: { type: 'password' } },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          include: { workspaceMembers: { include: { workspace: true }, take: 1 } },
        })
        if (!user || !user.passwordHash) return null
        const valid = await bcrypt.compare(credentials.password as string, user.passwordHash)
        if (!valid) return null
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatarUrl,
          workspaceId: user.workspaceMembers[0]?.workspaceId ?? null,
        }
      },
    }),
  ],
})
