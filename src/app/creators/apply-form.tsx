"use client";
import { useActionState } from "react";
import Link from "next/link";
import { Button, Field, Input, Textarea } from "@/components/ui";
import { applyAsCreator, type ApplyState } from "./actions";

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? <span id={id} className="mt-1 block text-sm text-coral-ink"><span aria-hidden>! </span>{message}</span> : null;
}

export function ApplyForm({ defaultName, defaultEmail }: { defaultName: string; defaultEmail: string }) {
  const [state, action, pending] = useActionState<ApplyState, FormData>(applyAsCreator, {});
  const v = state.values ?? {};
  const err = (k: string) => state.fieldErrors?.[k];
  const errId = (k: string) => (err(k) ? `${k}-err` : undefined);

  return (
    <form action={action} className="space-y-4" noValidate>
      <div>
        <Field label="Name people will see" id="display_name">
          <Input id="display_name" name="display_name" defaultValue={v.display_name ?? defaultName} required maxLength={60} aria-invalid={!!err("display_name")} aria-describedby={errId("display_name")} />
        </Field>
        <FieldError id="display_name-err" message={err("display_name")} />
      </div>
      <div>
        <Field label="Short bio" id="bio" hint="Who you help and what you've coached or led.">
          <Textarea id="bio" name="bio" defaultValue={v.bio ?? ""} maxLength={600} aria-invalid={!!err("bio")} aria-describedby={errId("bio")} />
        </Field>
        <FieldError id="bio-err" message={err("bio")} />
      </div>
      <div>
        <Field label="Website (optional)" id="website">
          <Input id="website" name="website" type="url" inputMode="url" placeholder="https://" defaultValue={v.website ?? ""} aria-invalid={!!err("website")} aria-describedby={errId("website")} />
        </Field>
        <FieldError id="website-err" message={err("website")} />
      </div>
      <div>
        <Field label="Payout email" id="payout_email" hint="Where we send payout setup details. Never shown publicly.">
          <Input id="payout_email" name="payout_email" type="email" defaultValue={v.payout_email ?? defaultEmail} required aria-invalid={!!err("payout_email")} aria-describedby={errId("payout_email")} />
        </Field>
        <FieldError id="payout_email-err" message={err("payout_email")} />
      </div>
      <div>
        <label className="flex min-h-11 items-start gap-3">
          <input type="checkbox" name="accept" value="yes" className="mt-1 h-5 w-5" aria-invalid={!!err("accept")} aria-describedby={errId("accept")} />
          <span className="text-sm">I accept the <Link href="/legal/terms#creators" className="underline">creator terms</Link>: my templates are my original work, contain no medical, financial or guaranteed-result claims, and earnings are split 70% to me and 30% to GoalKin.</span>
        </label>
        <FieldError id="accept-err" message={err("accept")} />
      </div>
      {state.error && <p role="alert" className="rounded-xl border border-coral/40 bg-coral/10 px-3 py-2 text-sm"><span aria-hidden>! </span>{state.error}</p>}
      <Button type="submit" disabled={pending}>{pending ? "Sending…" : "Apply to be a creator"}</Button>
    </form>
  );
}
