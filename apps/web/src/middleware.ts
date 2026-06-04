import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { pathname } = req.nextUrl
  // Treat auth errors (missing/invalid secret) as unauthenticated — never expose protected pages
  const isAuth = !!req.auth && !(req.auth as { error?: unknown }).error
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/signup')
  const protectedPrefixes = [
    '/dashboard', '/actors', '/datasets', '/workflows', '/enrichment',
    '/settings', '/playbooks', '/linkedin', '/schedules',
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
  if (pathname === '/' && isAuth) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://avatars.githubusercontent.com https://lh3.googleusercontent.com https://api.dicebear.com",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ')

  const response = NextResponse.next()
  response.headers.set('Content-Security-Policy', csp)
  // Prevent Railway/CDN edge caching of all pages — auth state must be checked per request
  response.headers.set('Cache-Control', 'no-store, must-revalidate')
  return response
})

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
