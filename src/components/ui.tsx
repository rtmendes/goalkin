import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
export { cx };

type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "sage";
const btnBase = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed";
const btnVariants: Record<BtnVariant, string> = {
  primary: "bg-navy text-[#F7F3EC] hover:opacity-90 dark:bg-gold dark:text-navy",
  secondary: "border border-line bg-surface text-ink hover:bg-surface-2",
  ghost: "text-ink hover:bg-surface-2",
  danger: "bg-coral-ink text-white hover:opacity-90",
  sage: "bg-sage text-white hover:opacity-90",
};

export function Button({ variant = "primary", className, ...p }: ComponentProps<"button"> & { variant?: BtnVariant }) {
  return <button className={cx(btnBase, btnVariants[variant], className)} {...p} />;
}

export function ButtonLink({ variant = "primary", className, ...p }: ComponentProps<typeof Link> & { variant?: BtnVariant }) {
  return <Link className={cx(btnBase, btnVariants[variant], className)} {...p} />;
}

export function Card({ className, ...p }: ComponentProps<"section">) {
  return <section className={cx("rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-5", className)} {...p} />;
}

export function PageHeader({ title, sub, action }: { title: string; sub?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">{title}</h1>
        {sub && <p className="mt-1 text-muted">{sub}</p>}
      </div>
      {action}
    </header>
  );
}

export function Field({ label, hint, children, id }: { label: string; hint?: string; children: ReactNode; id?: string }) {
  return (
    <label className="block" htmlFor={id}>
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const inputCls = "w-full min-h-11 rounded-xl border border-line bg-surface px-3 py-2 text-ink placeholder:text-muted";

export function Input(p: ComponentProps<"input">) {
  return <input {...p} className={cx(inputCls, p.className)} />;
}
export function Textarea(p: ComponentProps<"textarea">) {
  return <textarea {...p} className={cx(inputCls, "min-h-24", p.className)} />;
}
export function Select(p: ComponentProps<"select">) {
  return <select {...p} className={cx(inputCls, p.className)} />;
}

/** Status pill that never relies on color alone: it always carries a word and an icon. */
export function StatusPill({ status }: { status: "on_track" | "behind" | "finished" | "not_started" | string }) {
  const map: Record<string, [string, string, string]> = {
    on_track: ["✓", "On track", "bg-sage/15 text-sage-ink"],
    behind: ["!", "Behind", "bg-coral/15 text-coral-ink"],
    finished: ["★", "Finished", "bg-gold/20 text-gold-ink"],
    not_started: ["○", "Not started", "bg-surface-2 text-muted"],
  };
  const [icon, label, cls] = map[status] ?? ["•", status, "bg-surface-2 text-muted"];
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", cls)}>
      <span aria-hidden>{icon}</span>
      {label}
    </span>
  );
}

export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" }) {
  return (
    <p role="note" className={cx("rounded-xl border px-3 py-2 text-sm", tone === "warn" ? "border-coral/40 bg-coral/10" : "border-line bg-surface-2")}>
      {children}
    </p>
  );
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-muted"><span>{label}</span><span>{value}%</span></div>
      <div role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} className="h-2.5 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-sage" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line p-6 text-center">
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
    </div>
  );
}
