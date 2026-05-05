<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into this Next.js 16 App Router project. Here's what was done:

- Created `instrumentation-client.ts` at the project root to initialize PostHog client-side using the Next.js 15.3+ recommended approach (no provider needed).
- Created `src/lib/posthog-server.ts` with a singleton `getPostHogClient()` helper for server-side event tracking.
- Updated `next.config.ts` to add PostHog reverse proxy rewrites (`/ingest/*`) and `skipTrailingSlashRedirect: true`, so events route through your own domain and avoid ad blockers.
- Configured `.env.local` with `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST`.
- Instrumented 10 client-side and server-side files with 12 distinct events, plus `posthog.identify()` calls at every signup/login point to tie sessions to real people.

| Event | Description | File |
|---|---|---|
| `interest_signup_submitted` | User submits the interest/waitlist form (top of funnel) | `src/components/interest-form.tsx` |
| `pre_registration_submitted` | User pre-registers before payment opens | `src/components/pre-register-form.tsx` |
| `rsvp_checkout_initiated` | User submits RSVP form and is sent to Stripe (client-side) | `src/components/rsvp-form.tsx` |
| `rsvp_checkout_created` | Stripe checkout session created for RSVP (server-side) | `src/app/api/checkout/route.ts` |
| `rsvp_registered` | Pay-at-door registration completed (server-side) | `src/app/api/register/route.ts` |
| `rsvp_payment_completed` | Stripe webhook confirms RSVP payment succeeded | `src/app/api/webhooks/stripe/route.ts` |
| `rsvp_payment_failed` | Stripe webhook marks RSVP payment as failed/expired | `src/app/api/webhooks/stripe/route.ts` |
| `sponsor_checkout_initiated` | User submits sponsor form and is sent to Stripe (client-side) | `src/components/sponsor-form.tsx` |
| `sponsor_checkout_created` | Stripe checkout session created for sponsorship (server-side) | `src/app/api/sponsor-checkout/route.ts` |
| `sponsor_payment_completed` | Stripe webhook confirms sponsor payment succeeded | `src/app/api/webhooks/stripe/route.ts` |
| `yearbook_profile_saved` | Attendee saves their digital yearbook profile | `src/components/profile-form.tsx` |
| `contact_message_sent` | Visitor sends a message to the reunion committee | `src/components/contact-modal.tsx` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard — Analytics basics**: https://us.posthog.com/project/410928/dashboard/1547379
- **Registration Conversion Funnel** (Interest → Checkout → Payment): https://us.posthog.com/project/410928/insights/xgpqrGsc
- **Daily Registrations** (Paid online + Pay at door): https://us.posthog.com/project/410928/insights/LSuT493h
- **Sponsor Conversion Funnel**: https://us.posthog.com/project/410928/insights/dEi5l4Oa
- **Payment Failures**: https://us.posthog.com/project/410928/insights/fC4Dcz8J
- **Yearbook Profile Completions**: https://us.posthog.com/project/410928/insights/xzcOqWmc

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-nextjs-app-router/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
