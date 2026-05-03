// Small "open in new tab" arrow icon. Used inline next to admin titles
// to launch the corresponding public site in a new browser tab.
export function LaunchIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14 5h5v5m0-5L10 14m-1 7H5a2 2 0 01-2-2V5a2 2 0 012-2h4"
      />
    </svg>
  );
}
