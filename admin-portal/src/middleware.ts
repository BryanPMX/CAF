import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip middleware for static files and API routes
  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.startsWith('/static')) {
    return NextResponse.next();
  }

  // Check if user is trying to access login page
  if (pathname === '/login') {
    // If user is already authenticated, redirect to appropriate dashboard
    const token = request.cookies.get('authToken')?.value || request.headers.get('authorization');
    if (token) {
      // User is already logged in, redirect based on role
      const userRole = request.cookies.get('userRole')?.value;
      let redirectPath = '/';
      
      if (userRole === 'admin' || userRole === 'office_manager') {
        redirectPath = '/admin';
      }
      
      return NextResponse.redirect(new URL(redirectPath, request.url));
    }
    return NextResponse.next();
  }

  // Check authentication for protected routes
  if (pathname.startsWith('/admin') || pathname.startsWith('/app') || pathname === '/') {
    const token = request.cookies.get('authToken')?.value || request.headers.get('authorization');
    
    if (!token) {
      // No token, redirect to login
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // For admin routes, check role
    if (pathname.startsWith('/admin')) {
      const userRole = request.cookies.get('userRole')?.value;
      if (userRole !== 'admin' && userRole !== 'office_manager') {
        // User doesn't have admin access, redirect to regular dashboard
        return NextResponse.redirect(new URL('/', request.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
