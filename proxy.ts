// Next.js 15+ Middleware for Authentication
// Updated to use the new auth() export pattern for Next.js 15+
import { NextResponse } from 'next/server';
import { auth } from './auth';
import { accessFor } from './lib/security/routePolicy';
import { securityHeaders } from './lib/security/headers';

const decide = (req: Parameters<Parameters<typeof auth>[0]>[0]) => {
  const { nextUrl } = req;
  const access = accessFor(nextUrl.pathname);

  if (access === 'public') {
    return;
  }

  if (!req.auth) {
    // API callers get a status code, pages get sent to the login form
    if (nextUrl.pathname.startsWith('/api/')) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const loginUrl = new URL('/login', nextUrl.origin);
    loginUrl.searchParams.set('callbackUrl', nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin routes need the admin role on top of a session
  if (access === 'admin' && req.auth.user?.role !== 'admin') {
    return Response.json(
      { error: 'Forbidden: Admin access required' },
      { status: 403 }
    );
  }
};

export default auth((req) => {
  const res = decide(req) ?? NextResponse.next();
  for (const [name, value] of Object.entries(securityHeaders())) res.headers.set(name, value);
  return res;
});

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
