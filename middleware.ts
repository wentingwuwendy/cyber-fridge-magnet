import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const publicPaths = ['/auth/login', '/auth/callback']
const apiPrefix = '/api'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  // API routes: pass session info via header for convenience
  if (request.nextUrl.pathname.startsWith(apiPrefix)) {
    if (session) {
      request.headers.set('x-user-email', session.user.email || '')
      request.headers.set('x-user-id', session.user.id || '')
    }
    return response
  }

  // Auth pages: allow access
  const pathname = request.nextUrl.pathname
  if (publicPaths.some(p => pathname.startsWith(p))) {
    if (session && pathname === '/auth/login') {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return response
  }

  // Protected: redirect to login if no session
  if (!session) {
    const redirectUrl = new URL('/auth/login', request.url)
    redirectUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|fridge.png).*)'],
}
