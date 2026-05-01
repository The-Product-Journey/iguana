/**
 * Tenant scope helpers — prevent cross-tenant data leaks at query time.
 *
 * Background: every tenant-scoped table either carries `reunionId` directly
 * (rsvps, events, sponsors, memorials, interestSignups, contactMessages) or
 * is reachable through one (registrationEvents → rsvps, profiles → rsvps,
 * eventInterests → interestSignups). Public pages live at `/[slug]/...`
 * and resolve the reunion via slug. The risk pattern is a route that looks
 * up a child row by id without verifying the row's reunionId matches the
 * URL's reunion.
 *
 * Phase 3B (the cross-tenant security gate before opening multi-tenancy)
 * adds these helpers and audits every public page / admin API route to
 * use them.
 *
 * Helpers
 *   - `requireRowInReunion(row, reunionId, opts?)`: returns the row if it
 *     belongs to the given reunion, otherwise calls notFound() (default)
 *     or returns null when `opts.silent` is true.
 *   - `whereInReunion(reunionId, ...filters)`: convenience for assembling
 *     a Drizzle `.where(...)` predicate that includes the reunion scope
 *     and any additional filters. The default-export pattern in callers:
 *     `where(whereInReunion(reunion.id, eq(profiles.id, profileId)))`.
 *
 * Tables that don't have `reunionId` directly (registration_events,
 * profiles, event_interests) must be scoped via a JOIN through their
 * parent table's `reunionId`. Those don't fit `whereInReunion` cleanly —
 * use the documented join patterns below:
 *
 *   profiles → rsvps.reunionId:
 *     .from(profiles).innerJoin(rsvps, eq(profiles.rsvpId, rsvps.id))
 *       .where(and(eq(rsvps.reunionId, reunion.id), <other predicates>))
 *
 *   registration_events → rsvps.reunionId:
 *     .from(registrationEvents).innerJoin(rsvps, eq(registrationEvents.rsvpId, rsvps.id))
 *       .where(and(eq(rsvps.reunionId, reunion.id), <other predicates>))
 *
 *   event_interests → interestSignups.reunionId:
 *     .from(eventInterests).innerJoin(interestSignups, eq(eventInterests.interestSignupId, interestSignups.id))
 *       .where(and(eq(interestSignups.reunionId, reunion.id), <other predicates>))
 */
import { and, eq } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import { notFound } from "next/navigation";

/**
 * Verify a row belongs to the expected reunion before exposing it.
 * notFound() on mismatch — same UX as a missing row, so we don't leak
 * "row exists but in another tenant" via response timing.
 */
export function requireRowInReunion<T extends { reunionId: string }>(
  row: T | null | undefined,
  reunionId: string
): T;
export function requireRowInReunion<T extends { reunionId: string }>(
  row: T | null | undefined,
  reunionId: string,
  opts: { silent: true }
): T | null;
export function requireRowInReunion<T extends { reunionId: string }>(
  row: T | null | undefined,
  reunionId: string,
  opts?: { silent?: boolean }
): T | null {
  if (!row || row.reunionId !== reunionId) {
    if (opts?.silent) return null;
    notFound();
  }
  return row;
}

/**
 * Compose a where predicate that scopes by reunion + any extra filters.
 * Only useful for tables that carry `reunionId` directly. For tables
 * scoped through a join, use the documented join patterns above.
 *
 * Usage:
 *   .where(whereInReunion(events.reunionId, reunion.id, eq(events.slug, "saturday-banquet")))
 *
 * The first argument is the column reference for `reunionId` on the table
 * being queried — that lets callers stay explicit about which table's
 * reunionId is being scoped (matters in multi-table joins).
 */
export function whereInReunion(
  reunionIdColumn: AnySQLiteColumn,
  reunionId: string,
  ...extra: (SQL | undefined)[]
): SQL | undefined {
  const filters = [eq(reunionIdColumn, reunionId), ...extra.filter((x): x is SQL => !!x)];
  if (filters.length === 1) return filters[0];
  return and(...filters);
}
