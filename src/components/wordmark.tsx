/**
 * Glad You Made It wordmark. Renders the brand asset PNG so the brand
 * name always reads in its actual typeface (Fraunces italic with the
 * persimmon "!"). Use this anywhere the brand name appears as a heading
 * or logo — never type "Glad You Made It" in plain system font.
 */
export function Wordmark({
  className = "h-8 w-auto",
}: {
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- brand PNG; remoteImage config not needed for /public assets
    <img
      src="/brand/glad-you-made-it-wordmark.png"
      alt="Glad You Made It"
      className={className}
    />
  );
}
