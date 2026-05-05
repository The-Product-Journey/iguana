import { SignUp } from "@clerk/nextjs";

/**
 * Sign-up landing page. Almost no one organically lands here — sign-up
 * is restricted to invited admins, so the path here is via the
 * `__clerk_ticket` query param attached to a Clerk invitation email
 * link. The <SignUp> component reads that param, validates the invite
 * with Clerk, and lets the user finish creating their account.
 *
 * After successful sign-up, Clerk redirects to the URL we passed as
 * `redirectUrl` when calling createInvitation in src/lib/clerk-invites.ts
 * (e.g. /admin/<slug> or /admin/super).
 */
export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-subtle px-6 py-12">
      <SignUp />
    </div>
  );
}
