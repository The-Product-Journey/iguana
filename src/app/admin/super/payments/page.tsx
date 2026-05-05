import { db } from "@/lib/db";
import {
  reunions,
  rsvps,
  sponsors,
  stripeConnectAccounts,
} from "@/lib/db/schema";
import { and, asc, desc, eq, gte, isNotNull } from "drizzle-orm";
import Link from "next/link";
import { requireSuperAdminPage } from "@/lib/admin-auth";
import {
  getConnectAccountName,
  stripeEnvironment,
} from "@/lib/stripe";
import { PaymentsClient } from "./payments-client";

export const dynamic = "force-dynamic";

type RangeKey = "30d" | "90d" | "1y" | "all";

const RANGE_DAYS: Record<RangeKey, number | null> = {
  "30d": 30,
  "90d": 90,
  "1y": 365,
  all: null,
};

function rangeKey(value: string | undefined): RangeKey {
  if (value === "30d" || value === "90d" || value === "1y" || value === "all")
    return value;
  return "90d";
}

function rangeStartIso(key: RangeKey): string | null {
  const days = RANGE_DAYS[key];
  if (days === null) return null;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  await requireSuperAdminPage();

  const params = await searchParams;
  const range = rangeKey(params.range);
  const startIso = rangeStartIso(range);

  // ---------------------------------------------------------------------
  // Connected accounts — every row in stripe_connect_accounts, joined
  // back to its reunion. Live name fetched from Stripe in parallel for
  // accounts whose env matches the current Stripe key set; cross-env
  // names show as "—" since we can't authenticate to retrieve them.
  // ---------------------------------------------------------------------
  const accountRows = await db
    .select({
      id: stripeConnectAccounts.id,
      accountId: stripeConnectAccounts.accountId,
      environment: stripeConnectAccounts.environment,
      detailsSubmitted: stripeConnectAccounts.detailsSubmitted,
      chargesEnabled: stripeConnectAccounts.chargesEnabled,
      payoutsEnabled: stripeConnectAccounts.payoutsEnabled,
      createdAt: stripeConnectAccounts.createdAt,
      reunionId: reunions.id,
      reunionSlug: reunions.slug,
      reunionName: reunions.name,
    })
    .from(stripeConnectAccounts)
    .innerJoin(reunions, eq(stripeConnectAccounts.reunionId, reunions.id))
    .orderBy(asc(reunions.name))
    .all();

  const currentEnv = stripeEnvironment();
  const accountNames = await Promise.all(
    accountRows.map(async (a) =>
      a.environment === currentEnv
        ? await getConnectAccountName(a.accountId)
        : null
    )
  );
  const accounts = accountRows.map((a, i) => ({
    ...a,
    name: accountNames[i],
  }));

  // ---------------------------------------------------------------------
  // RSVP payments — anything that went through Stripe (paid or failed),
  // bounded by the selected date range. We use createdAt as the
  // signal; failed rows still mean a checkout session was opened.
  // ---------------------------------------------------------------------
  const rsvpWhere = startIso
    ? and(isNotNull(rsvps.stripeCheckoutSessionId), gte(rsvps.createdAt, startIso))
    : isNotNull(rsvps.stripeCheckoutSessionId);

  const rsvpPayments = await db
    .select({
      id: rsvps.id,
      firstName: rsvps.firstName,
      lastName: rsvps.lastName,
      email: rsvps.email,
      amountPaidCents: rsvps.amountPaidCents,
      paymentStatus: rsvps.paymentStatus,
      stripeCheckoutSessionId: rsvps.stripeCheckoutSessionId,
      createdAt: rsvps.createdAt,
      reunionId: reunions.id,
      reunionName: reunions.name,
      reunionSlug: reunions.slug,
    })
    .from(rsvps)
    .innerJoin(reunions, eq(rsvps.reunionId, reunions.id))
    .where(rsvpWhere)
    .orderBy(desc(rsvps.createdAt))
    .all();

  // ---------------------------------------------------------------------
  // Sponsor payments — sponsors with a stripe session, same range.
  // ---------------------------------------------------------------------
  const sponsorWhere = startIso
    ? and(
        isNotNull(sponsors.stripeCheckoutSessionId),
        gte(sponsors.createdAt, startIso)
      )
    : isNotNull(sponsors.stripeCheckoutSessionId);

  const sponsorPayments = await db
    .select({
      id: sponsors.id,
      contactName: sponsors.contactName,
      contactEmail: sponsors.contactEmail,
      companyName: sponsors.companyName,
      amountCents: sponsors.amountCents,
      paymentStatus: sponsors.paymentStatus,
      stripeCheckoutSessionId: sponsors.stripeCheckoutSessionId,
      createdAt: sponsors.createdAt,
      reunionId: reunions.id,
      reunionName: reunions.name,
      reunionSlug: reunions.slug,
    })
    .from(sponsors)
    .innerJoin(reunions, eq(sponsors.reunionId, reunions.id))
    .where(sponsorWhere)
    .orderBy(desc(sponsors.createdAt))
    .all();

  return (
    <div>
      <Link
        href="/admin"
        className="mb-4 inline-block text-sm font-medium text-forest hover:text-forest-deep"
      >
        &larr; Back to admin
      </Link>

      <h2 className="mb-2 text-3xl font-semibold text-ink">Manage payments</h2>
      <p className="mb-8 text-sm text-ink-muted">
        Cross-tenant view of every connected Stripe account and every payment
        that flowed through Glad You Made It. Super-admin only.
      </p>

      <PaymentsClient
        accounts={accounts}
        rsvpPayments={rsvpPayments}
        sponsorPayments={sponsorPayments}
        range={range}
        currentEnv={currentEnv}
        passwordRequired={!!process.env.STRIPE_DISCONNECT_PASSWORD}
      />
    </div>
  );
}
