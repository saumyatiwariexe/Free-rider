import { SignUp } from '@clerk/nextjs';

/**
 * Clerk catch-all sign-up page.
 */
export default function SignUpPage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <SignUp />
    </main>
  );
}
