"use client";
import { useActionState, useState } from "react";
import { Button, Field, Input, Notice } from "@/components/ui";
import { googleSignIn, passwordAuth, sendMagicLink, type AuthState } from "./actions";

function Status({ state }: { state: AuthState }) {
  if (state.error) return <p role="alert" className="rounded-xl border border-coral/40 bg-coral/10 px-3 py-2 text-sm"><span aria-hidden>! </span>{state.error}</p>;
  if (state.message) return <p role="status" className="rounded-xl border border-sage/40 bg-sage/10 px-3 py-2 text-sm"><span aria-hidden>✓ </span>{state.message}</p>;
  return null;
}

export function LoginForm({ next, initialError }: { next: string; initialError?: string }) {
  const [linkState, linkAction, linkPending] = useActionState(sendMagicLink, {});
  const [pwState, pwAction, pwPending] = useActionState(passwordAuth, {});
  const [usePassword, setUsePassword] = useState(false);

  return (
    <div className="space-y-6">
      {initialError && <Notice tone="warn">{initialError}</Notice>}

      <form action={googleSignIn}>
        <input type="hidden" name="next" value={next} />
        <Button type="submit" variant="secondary" className="w-full">
          <span aria-hidden className="font-bold">G</span> Continue with Google
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted" aria-hidden>
        <span className="h-px flex-1 bg-line" />or use your email<span className="h-px flex-1 bg-line" />
      </div>

      {!usePassword ? (
        <form action={linkAction} className="space-y-3" noValidate>
          <input type="hidden" name="next" value={next} />
          <Field label="Email" id="email-link">
            <Input id="email-link" name="email" defaultValue={linkState.email ?? ""} type="email" autoComplete="email" inputMode="email" required placeholder="you@example.com" />
          </Field>
          <Button type="submit" className="w-full" disabled={linkPending}>{linkPending ? "Sending…" : "Email me a sign-in link"}</Button>
          <div aria-live="polite"><Status state={linkState} /></div>
          <p className="text-sm text-muted">No password needed. New here? The link creates your account.</p>
        </form>
      ) : (
        <form action={pwAction} className="space-y-3" noValidate>
          <input type="hidden" name="next" value={next} />
          <Field label="Email" id="email-pw">
            <Input id="email-pw" name="email" defaultValue={pwState.email ?? ""} type="email" autoComplete="email" inputMode="email" required placeholder="you@example.com" />
          </Field>
          <Field label="Password" id="password" hint="At least 8 characters.">
            <Input id="password" name="password" type="password" autoComplete="current-password" required minLength={8} />
          </Field>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button type="submit" name="mode" value="signin" disabled={pwPending}>{pwPending ? "Working…" : "Sign in"}</Button>
            <Button type="submit" name="mode" value="signup" variant="secondary" disabled={pwPending}>Create account</Button>
          </div>
          <div aria-live="polite"><Status state={pwState} /></div>
        </form>
      )}

      <button type="button" onClick={() => setUsePassword((v) => !v)} className="min-h-11 text-sm font-semibold underline underline-offset-4">
        {usePassword ? "Use a sign-in link instead" : "Use a password instead"}
      </button>
    </div>
  );
}
