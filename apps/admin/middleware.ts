import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { ADMIN_ACCESS_COOKIE, validateAdminAccessToken } from './app/lib/admin-auth'

function isPublicPath(pathname: string) {
  if (pathname === '/login') return true
  if (pathname.startsWith('/coordenadora/')) return true
  if (pathname.startsWith('/public/')) return true
  if (pathname === '/api/admin/auth/login') return true

  if (pathname.startsWith('/api/account') && !pathname.startsWith('/api/account/verification/admin')) {
    return true
  }
  if (pathname.startsWith('/api/ai/')) return true
  if (pathname.startsWith('/api/reports')) return true
  if (pathname.startsWith('/api/uploads')) return true
  if (pathname.startsWith('/api/materials')) return true
  if (pathname.startsWith('/api/personal-documents')) return true
  if (pathname.startsWith('/api/coordinator/public/')) return true
  if (pathname.startsWith('/api/coordinator/share')) return true
  if (pathname.startsWith('/api/coordinator/share-document')) return true
  if (pathname.startsWith('/api/coordinator/access-password')) return true
  if (pathname.startsWith('/api/coordinator/review-events')) return true
  if (pathname.startsWith('/api/continuity/search')) return true
  if (pathname.startsWith('/api/continuity/requests') && !pathname.startsWith('/api/continuity/requests/admin')) {
    return true
  }

  return false
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (isPublicPath(pathname)) return NextResponse.next()

  const token = request.cookies.get(ADMIN_ACCESS_COOKIE)?.value
  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    }
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  const session = await validateAdminAccessToken(token)
  if (!session) {
    const response = pathname.startsWith('/api/')
      ? NextResponse.json({ error: 'Sessão inválida ou sem permissão.' }, { status: 401 })
      : NextResponse.redirect(new URL('/login', request.url))

    response.cookies.set(ADMIN_ACCESS_COOKIE, '', { path: '/', maxAge: 0 })
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png).*)'],
}
