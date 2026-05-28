import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isAuth = !!req.auth
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/signup')
  const protectedPrefixes = [
    '/dashboard', '/actors', '/datasets', '/workflows', '/enrichment',
    '/settings', '/playbooks', '/linkedin', '/schedules', '/billing',
    '/proxy', '/store', '/phantoms', '/leads', '/sequences', '/runs',
    '/analytics', '/members', '/webhooks', '/usage',
  ]
  const isDashboard = protectedPrefixes.some(p => pathname === p || pathname.startsWith(p + '/'))

  if (isDashboard && !isAuth) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  if (isAuthPage && isAuth) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }
  // Redirect root to dashboard for authenticated users
  if (pathname === '/' && isAuth) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }
  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
