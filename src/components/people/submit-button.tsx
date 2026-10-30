"use client";
import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";

export function SubmitButton({ children, pendingText = "Saving…", ...p }: ComponentProps<typeof Button> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" {...p} disabled={pending || p.disabled} aria-disabled={pending || undefined}>
      {pending ? pendingText : children}
    </Button>
  );
}
