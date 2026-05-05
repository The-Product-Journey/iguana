/**
 * Warm-voice empty state. The intro line uses Fraunces italic for a
 * single moment of editorial warmth — this pattern is one of the few
 * places the brand voice shows up, so use it sparingly. The body line
 * stays in the default sans (Bricolage Grotesque) so it doesn't
 * compete.
 */
export function EmptyState({
  intro,
  body,
  className = "",
}: {
  intro: string;
  body: string;
  className?: string;
}) {
  return (
    <div className={`py-12 text-center ${className}`}>
      <p className="font-serif text-2xl font-light italic text-ink sm:text-3xl">
        {intro}
      </p>
      <p className="mt-3 text-base text-ink-muted">{body}</p>
    </div>
  );
}
