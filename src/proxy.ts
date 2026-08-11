import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

/**
 * Public paths — everything else is protected by Clerk auth.
 * Next.js 16: this file is named proxy.ts (renamed from middleware.ts).
 * Clerk v7+: createRouteMatcher is deprecated; use manual path checks instead.
 */
const PUBLIC_PREFIXES = [
  '/',
  '/sign-in',
  '/sign-up',
  '/api/webhooks',
  '/api/test',    // phase verification endpoints — remove before production
  '/api/health',
];

export default clerkMiddleware(async (auth, request) => {
  const { pathname } = new URL(request.url);

  const isPublic =
    pathname === '/' ||
    PUBLIC_PREFIXES.slice(1).some((prefix) => pathname.startsWith(prefix));

  if (!isPublic) {
    await auth.protect();
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
