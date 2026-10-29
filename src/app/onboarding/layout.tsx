import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata = { title: "Set up your goal" };

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-4 pt-4">
      <header className="mb-6 flex items-center justify-between">
        <Link href="/app" className="text-ink" aria-label="GoalKin home"><Logo className="h-7" /></Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link href="/app" className="min-h-11 py-2.5 text-sm text-muted underline">Exit</Link>
        </div>
      </header>
      <main id="main">{children}</main>
    </div>
  );
}
