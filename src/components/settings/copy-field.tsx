"use client";
import { useState } from "react";
import { Button, inputCls } from "@/components/ui";

export function CopyField({ id, label, value }: { id: string; label: string; value: string }) {
  const [status, setStatus] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setStatus("Copied.");
    } catch {
      (document.getElementById(id) as HTMLInputElement | null)?.select();
      setStatus("Select the link and copy it.");
    }
  }
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold">{label}</label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input id={id} readOnly value={value} className={`${inputCls} font-mono text-xs`} onFocus={(e) => e.currentTarget.select()} />
        <Button type="button" variant="secondary" onClick={copy}>Copy</Button>
      </div>
      <p aria-live="polite" className="mt-1 text-xs text-muted">{status}</p>
    </div>
  );
}
