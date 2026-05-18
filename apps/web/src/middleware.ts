import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isAuth = !!req.auth
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/signup')
  const isDashboard = pathname.startsWith('/dashboard') || pathname === '/actors' ||
    pathname === '/datasets' || pathname === '/workflows' || pathname === '/enrichment' ||
    pathname === '/settings' || pathname === '/playbooks' || pathname === '/linkedin' ||
    pathname === '/schedules' || pathname === '/billing' || pathname === '/proxy' ||
    pathname === '/store' || pathname === '/phantoms'

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
