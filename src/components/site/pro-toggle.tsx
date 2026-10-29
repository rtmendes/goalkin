"use client";
import { useState } from "react";
import { cx } from "@/components/ui";
import { CheckoutButton } from "@/components/site/checkout-button";

/** Monthly / yearly switch for Pro. Both checkout links are resolved on the server. */
export function ProToggle({ monthlyHref, yearlyHref }: { monthlyHref: string | null; yearlyHref: string | null }) {
  const [yearly, setYearly] = useState(false);
  return (
    <div>
      <fieldset>
        <legend className="sr-only">Billing period</legend>
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1">
          {[false, true].map((y) => (
            <button key={String(y)} type="button" aria-pressed={yearly === y} onClick={() => setYearly(y)}
              className={cx("min-h-11 rounded-lg text-sm font-semibold", yearly === y ? "bg-surface text-ink shadow-sm" : "text-muted")}>
              {yearly === y && <span aria-hidden>● </span>}{y ? "Yearly" : "Monthly"}
            </button>
          ))}
        </div>
      </fieldset>
      <p className="mt-3 font-display text-3xl font-bold" aria-live="polite">
        {yearly ? "$79" : "$9"}<span className="text-base font-normal text-muted"> {yearly ? "a year (about $6.58/mo)" : "a month"}</span>
      </p>
      <div className="mt-3">
        <CheckoutButton href={yearly ? yearlyHref : monthlyHref} label={yearly ? "Get Pro yearly" : "Get Pro monthly"} />
      </div>
    </div>
  );
}
