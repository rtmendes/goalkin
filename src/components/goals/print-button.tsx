"use client";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="min-h-11 rounded-xl border border-line bg-surface px-4 text-sm font-semibold hover:bg-surface-2">
      Print or save as PDF
    </button>
  );
}
