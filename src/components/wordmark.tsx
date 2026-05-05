/**
 * Glad You Made It wordmark. The brand name is rendered ONLY through
 * this SVG — never type "Glad You Made It" in plain system font.
 *
 * Three SVG variants live in /public/brand/:
 *   - wordmark.svg          — default for light surfaces (white, cream)
 *   - wordmark-dark.svg     — for forest / dark surfaces
 *   - wordmark-adaptive.svg — currentColor variant; inherits parent `color`
 */
type Variant = "default" | "dark" | "adaptive";

export function Wordmark({
  className = "h-8 w-auto",
  variant = "default",
}: {
  className?: string;
  variant?: Variant;
}) {
  const src =
    variant === "dark"
      ? "/brand/glad-you-made-it-wordmark-dark.svg"
      : variant === "adaptive"
      ? "/brand/glad-you-made-it-wordmark-adaptive.svg"
      : "/brand/glad-you-made-it-wordmark.svg";

  return (
    // eslint-disable-next-line @next/next/no-img-element -- brand SVG; remoteImage config not needed for /public assets
    <img src={src} alt="Glad You Made It" className={className} />
  );
}
