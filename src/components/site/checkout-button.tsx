import { Button, cx } from "@/components/ui";

const base = "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition";

/** A checkout link, or a disabled "opens soon" button when no URL is configured (never a dead link). */
export function CheckoutButton({ href, label, variant = "primary" }: { href: string | null; label: string; variant?: "primary" | "secondary" }) {
  if (!href) {
    return (
      <Button type="button" variant="secondary" disabled aria-disabled className="w-full">
        Checkout opens soon
      </Button>
    );
  }
  return (
    <a href={href} rel="noopener"
      className={cx(base, variant === "primary" ? "bg-navy text-[#F7F3EC] hover:opacity-90 dark:bg-gold dark:text-navy" : "border border-line bg-surface text-ink hover:bg-surface-2")}>
      {label}
    </a>
  );
}
