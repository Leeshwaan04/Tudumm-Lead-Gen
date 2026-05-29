import { auth } from '@/auth'
import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'

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
  if (pathname === '/' && isAuth) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  // Generate a per-request nonce for CSP — eliminates need for unsafe-inline/unsafe-eval
  const nonce = randomBytes(16).toString('base64')
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'", // Tailwind inlines styles; safe for CSS only
    "img-src 'self' data: https://avatars.githubusercontent.com https://lh3.googleusercontent.com https://api.dicebear.com",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
  ].join('; ')

  const response = NextResponse.next()
  response.headers.set('Content-Security-Policy', csp)
  response.headers.set('x-nonce', nonce)
  return response
})

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
