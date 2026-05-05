import { Suspense } from "react";
import { SignUpClient } from "./sign-up-client";

/**
 * Sign-up landing page. Most users arrive here via a Clerk invitation
 * email link — the `__clerk_ticket` query param is what makes the
 * <SignUp> component validate the invitation and present a sign-up
 * form. After successful sign-up, the user is redirected to whatever
 * was passed as `next` (e.g. /admin/<slug> or /admin/super), falling
 * back to /admin's role-based router.
 */
export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-subtle px-6 py-12">
      <Suspense fallback={null}>
        <SignUpClient />
      </Suspense>
    </div>
  );
}
