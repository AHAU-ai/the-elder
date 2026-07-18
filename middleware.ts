import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'elder_beta_access';
const COOKIE_VALUE = 'granted';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow the gate page and its API route, plus Next.js internals/static assets
  if (
    pathname.startsWith('/beta-gate') ||
    pathname.startsWith('/api/beta-gate') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(COOKIE_NAME);
  if (cookie?.value === COOKIE_VALUE) {
    return NextResponse.next();
  }

  const gateUrl = new URL('/beta-gate', req.url);
  gateUrl.searchParams.set('next', pathname);
  return NextResponse.redirect(gateUrl);
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
};
