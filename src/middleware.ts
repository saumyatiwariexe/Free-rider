import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

/**
 * Public routes — everything else is protected by Clerk auth.
 * Add paths here as the app grows (e.g., /api/webhooks/* must stay public
 * because Clerk/GitHub webhooks call them without a session cookie).
 */
const isPublicRoute = createRouteMatcher([
  '/',              // landing page
  '/sign-in(.*)',   // Clerk hosted sign-in
  '/sign-up(.*)',   // Clerk hosted sign-up
  '/api/webhooks/(.*)', // Clerk + GitHub webhook consumers — no auth header
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
