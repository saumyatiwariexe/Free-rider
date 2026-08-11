import { SignIn } from '@clerk/nextjs';

/**
 * Clerk catch-all sign-in page.
 * The [[...sign-in]] dynamic segment lets Clerk handle all sub-paths
 * (e.g., /sign-in, /sign-in/factor-one, /sign-in/sso-callback, etc.)
 */
export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <SignIn />
    </main>
  );
}
