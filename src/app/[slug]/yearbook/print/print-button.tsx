"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="ml-4 rounded-full bg-tenant-primary px-4 py-1 text-white hover:bg-tenant-primary-deep"
    >
      Print
    </button>
  );
}
