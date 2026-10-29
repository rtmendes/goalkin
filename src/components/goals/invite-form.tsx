"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Button, inputCls } from "@/components/ui";
import { CopyButton } from "@/components/goals/copy-button";
import { inviteChosenPerson } from "@/lib/goals-core/actions/share";

export function InviteForm({ goalId }: { goalId: string }) {
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<{ url?: string; email?: string; error?: string; upgrade?: boolean } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await inviteChosenPerson(goalId, email);
            if (r.ok) {
              setResult({ url: r.url, email: r.email });
              setEmail("");
            } else setResult({ error: r.error, upgrade: r.upgrade });
          });
        }}>
        <label className="min-w-0 flex-1">
          <span className="mb-1 block text-sm font-semibold">Their email</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} autoComplete="email" />
        </label>
        <Button type="submit" disabled={pending}>{pending ? "Creating..." : "Create invite"}</Button>
      </form>
      <div aria-live="polite" className="mt-2 text-sm">
        {result?.url && (
          <div className="rounded-xl bg-surface-2 p-3">
            <p>Send this link to {result.email}. They’ll see the Chosen people preview once they accept.</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="break-all rounded bg-surface px-2 py-1">{result.url}</code>
              <CopyButton text={result.url} />
            </div>
          </div>
        )}
        {result?.error && (
          <p className="text-coral-ink">{result.error} {result.upgrade && <Link href="/pricing" className="underline">Upgrade</Link>}</p>
        )}
      </div>
    </div>
  );
}
