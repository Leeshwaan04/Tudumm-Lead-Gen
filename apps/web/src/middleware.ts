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
  if (pathname === '/' && isAuth) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  // Generate a per-request nonce for CSP using Web Crypto (Edge-runtime compatible)
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))))
  const isDev = process.env.NODE_ENV === 'development'
  const scriptSrc = isDev
    ? `script-src 'self' 'nonce-${nonce}' 'unsafe-eval'`  // dev HMR requires unsafe-eval
    : `script-src 'self' 'nonce-${nonce}'`
  const csp = [
    "default-src 'self'",
    scriptSrc,
    // style-src retains unsafe-inline: React 19 emits inline style={{...}} props; CSS cannot exfiltrate data
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
  response.headers.set('x-nonce', nonce)
  return response
})

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
