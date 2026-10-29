"use client";
import { useState } from "react";
import { Button, Field, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/people/submit-button";

/**
 * Note composer with one-tap "what to say after a missed week" templates.
 * The action is a Server Action bound to the circle.
 */
export function EncourageComposer({
  action,
  templates,
  members,
  initialText = "",
  initialTo = "",
}: {
  action: (fd: FormData) => Promise<void>;
  templates: readonly string[];
  members: { id: string; name: string }[];
  initialText?: string;
  initialTo?: string;
}) {
  const [text, setText] = useState(initialText);
  return (
    <form action={action} className="space-y-3">
      <Field label="To" id="enc-to">
        <Select id="enc-to" name="to_id" defaultValue={initialTo}>
          <option value="">Everyone in the circle</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </Select>
      </Field>
      <Field label="Your note" id="enc-body">
        <Textarea id="enc-body" name="body" required maxLength={500} value={text} onChange={(e) => setText(e.target.value)} placeholder="Say something kind and specific." />
      </Field>
      <fieldset>
        <legend className="mb-1 text-sm font-semibold">Need words? After a missed week, try:</legend>
        <ul className="flex flex-col gap-2">
          {templates.map((t) => (
            <li key={t}>
              <Button type="button" variant="ghost" className="h-auto w-full justify-start border border-line text-left font-normal" onClick={() => setText(t)}>
                {t}
              </Button>
            </li>
          ))}
        </ul>
      </fieldset>
      <SubmitButton pendingText="Sending…">Send note</SubmitButton>
    </form>
  );
}
