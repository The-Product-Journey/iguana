"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="ml-4 rounded-full bg-blue-600 px-4 py-1 text-white hover:bg-blue-700"
    >
      Print
    </button>
  );
}
