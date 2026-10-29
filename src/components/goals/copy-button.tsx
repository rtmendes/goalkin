"use client";
import { useState } from "react";

export function CopyButton({ text, label = "Copy link" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="min-h-11 rounded-xl border border-line bg-surface px-3 text-sm font-semibold hover:bg-surface-2"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {
          /* clipboard blocked; the link is visible to copy by hand */
        }
      }}>
      <span aria-live="polite">{done ? "Copied" : label}</span>
    </button>
  );
}
