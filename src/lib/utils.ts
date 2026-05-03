export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Resolve the public display name for a sponsor, applying the same rules
 * the public sponsors page and admin views all use:
 *   1. If isAnonymous -> "Anonymous Sponsor"
 *   2. If displayName is set -> displayName (their explicit override)
 *   3. Otherwise -> companyName || contactName (defaults)
 */
export function resolveSponsorDisplayName(sponsor: {
  contactName: string;
  companyName: string | null;
  displayName: string | null;
  isAnonymous: boolean | null;
}): string {
  if (sponsor.isAnonymous) return "Anonymous Sponsor";
  if (sponsor.displayName && sponsor.displayName.trim()) {
    return sponsor.displayName.trim();
  }
  return sponsor.companyName || sponsor.contactName;
}

/**
 * Format a tentative day-level descriptor for an event without committing to
 * an exact time — e.g. "Tentatively Friday", "Tentatively Saturday morning",
 * "Tentatively Saturday evening". Used in the interest form / tease landing
 * where details aren't fully locked yet.
 *
 * Time-of-day phase is derived from `eventTime` (e.g. "5:00 PM") when
 * available. If absent, falls back to just the day name.
 */
export function formatTentativeWhen(
  eventDate: string,
  eventTime: string | null
): string {
  const day = new Date(eventDate + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
  });

  if (!eventTime) return `Tentatively ${day}`;

  const match = eventTime.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (!match) return `Tentatively ${day}`;

  let hour = parseInt(match[1], 10);
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === "PM" && hour < 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;

  let phase: string;
  if (hour < 12) phase = "morning";
  else if (hour < 17) phase = "afternoon";
  else phase = "evening";

  return `Tentatively ${day} ${phase}`;
}
