import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip proxy checks for static files and API routes.
  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.startsWith('/static')) {
    return NextResponse.next();
  }

  if (pathname === '/login') {
    const token = request.cookies.get('authToken')?.value || request.headers.get('authorization');
    if (token) {
      const userRole = request.cookies.get('userRole')?.value;
      const redirectPath = userRole === 'admin' || userRole === 'office_manager' ? '/admin' : '/';
      return NextResponse.redirect(new URL(redirectPath, request.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith('/admin') || pathname.startsWith('/app') || pathname === '/') {
    const token = request.cookies.get('authToken')?.value || request.headers.get('authorization');
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // This is a navigation guard only. The API remains the authorization boundary.
    if (pathname.startsWith('/admin')) {
      const userRole = request.cookies.get('userRole')?.value;
      if (userRole !== 'admin' && userRole !== 'office_manager') {
        return NextResponse.redirect(new URL('/', request.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
