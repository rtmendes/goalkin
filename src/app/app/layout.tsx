import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { requireUser, isAdminEmail } from "@/lib/auth";
import { effectivePlan } from "@/lib/entitlements";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await requireUser();
  const plan = effectivePlan(profile);
  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl gap-6 px-4 pb-24 pt-4 md:pb-8">
      <aside className="hidden w-52 shrink-0 md:block">
        <Link href="/app" className="mb-6 block text-ink"><Logo /></Link>
        <AppNav variant="side" />
        <div className="mt-6 space-y-3 text-sm">
          <p className="text-muted">Plan: <span className="font-semibold capitalize text-ink">{plan}</span>{plan === "free" && <> · <Link className="underline" href="/pricing">Upgrade</Link></>}</p>
          {isAdminEmail(user.email) && <Link className="block underline" href="/admin">Admin</Link>}
          <ThemeToggle />
          <form action="/auth/signout" method="post"><button className="text-muted underline">Sign out</button></form>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <div className="mb-4 flex items-center justify-between md:hidden">
          <Link href="/app" className="text-ink"><Logo className="h-7" /></Link>
          <ThemeToggle />
        </div>
        <main id="main">{children}</main>
      </div>
      <AppNav variant="bottom" />
    </div>
  );
}
