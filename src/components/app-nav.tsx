"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export const NAV = [
  { href: "/app", label: "Today", icon: "☀" },
  { href: "/app/goals", label: "Goals", icon: "◎" },
  { href: "/app/circles", label: "Circles", icon: "◍" },
  { href: "/app/focus", label: "Focus", icon: "⏱" },
  { href: "/marketplace", label: "Templates", icon: "▦" },
  { href: "/app/settings", label: "Settings", icon: "⚙" },
];

export function AppNav({ variant }: { variant: "side" | "bottom" }) {
  const path = usePathname();
  const active = (href: string) => (href === "/app" ? path === "/app" : path.startsWith(href));
  if (variant === "bottom") {
    return (
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur md:hidden">
        <ul className="grid grid-cols-6">
          {NAV.map((n) => (
            <li key={n.href}>
              <Link href={n.href} aria-current={active(n.href) ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center text-[11px] ${active(n.href) ? "font-bold text-ink" : "text-muted"}`}>
                <span aria-hidden className="text-lg leading-none">{n.icon}</span>
                {n.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    );
  }
  return (
    <nav aria-label="Main" className="hidden md:block">
      <ul className="space-y-1">
        {NAV.map((n) => (
          <li key={n.href}>
            <Link href={n.href} aria-current={active(n.href) ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-xl px-3 ${active(n.href) ? "bg-surface-2 font-semibold" : "text-muted hover:bg-surface-2"}`}>
              <span aria-hidden>{n.icon}</span>
              {n.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
