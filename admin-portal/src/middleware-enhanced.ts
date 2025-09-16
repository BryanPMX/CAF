// admin-portal/src/middleware.ts
// Enhanced middleware with IP whitelist for admin portal security

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// IP whitelist for admin portal access
const ALLOWED_IPS = [
  // CAF Office IP addresses (replace with actual office IPs)
  '192.168.1.0/24',     // Office network range
  '10.0.0.0/8',         // VPN network range
  '172.16.0.0/12',      // Additional office networks
  
  // Development IPs (remove in production)
  '127.0.0.1',          // Localhost
  '::1',                // IPv6 localhost
  
  // Add your actual office IP addresses here
  // '203.0.113.0/24',   // Example office IP range
];

// Function to check if IP is in whitelist
function isIPAllowed(clientIP: string): boolean {
  if (!clientIP) return false;
  
  // Allow localhost in development
  if (process.env.NODE_ENV === 'development') {
    if (clientIP === '127.0.0.1' || clientIP === '::1') {
      return true;
    }
  }
  
  // Check against whitelist
  return ALLOWED_IPS.some(allowedIP => {
    if (allowedIP.includes('/')) {
      // CIDR notation
      return isIPInCIDR(clientIP, allowedIP);
    } else {
      // Exact IP match
      return clientIP === allowedIP;
    }
  });
}

// Simple CIDR check (for basic implementation)
function isIPInCIDR(ip: string, cidr: string): boolean {
  const [network, prefixLength] = cidr.split('/');
  const ipNum = ipToNumber(ip);
  const networkNum = ipToNumber(network);
  const mask = (0xffffffff << (32 - parseInt(prefixLength))) >>> 0;
  
  return (ipNum & mask) === (networkNum & mask);
}

// Convert IP to number for CIDR calculations
function ipToNumber(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip middleware for static files and API routes
  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.startsWith('/static')) {
    return NextResponse.next();
  }

  // IP whitelist check for admin routes
  if (pathname.startsWith('/admin')) {
    const clientIP = request.ip || 
                    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                    request.headers.get('x-real-ip') ||
                    'unknown';
    
    if (!isIPAllowed(clientIP)) {
      console.log(`🚫 Blocked admin access from IP: ${clientIP}`);
      return new NextResponse(
        JSON.stringify({ 
          error: 'Access Denied', 
          message: 'Admin portal access is restricted to authorized networks only.',
          ip: clientIP 
        }),
        { 
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            'X-IP-Blocked': clientIP
          }
        }
      );
    }
    
    console.log(`✅ Allowed admin access from IP: ${clientIP}`);
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
