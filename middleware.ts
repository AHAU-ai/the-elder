import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { captureReferral } from '@/lib/referral';

// Runs on every page request (not /api/* -- see matcher below; API routes
// don't need referral capture, and excluding them keeps this middleware
// off the hot generation path entirely). Only ever ADDS a cookie when one
// isn't already set (lib/referral.ts's captureReferral) -- never blocks,
// redirects, or rewrites, so a bug here degrades to "no attribution
// recorded" at worst, never to a broken page load.
export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  captureReferral(req, res);
  return res;
}

export const config = {
  matcher: [
    // All paths except /api/*, static assets, and Next internals.
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
