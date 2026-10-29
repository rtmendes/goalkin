import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteShell } from "@/components/site/site-shell";
import { Card } from "@/components/ui";
import { optionalUser } from "@/lib/site/session";
import { safeNext } from "@/lib/site/redirect";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  link: "That sign-in link has expired or was already used. Send yourself a new one below.",
  google: "Google sign-in didn't finish. Try again, or use an email link.",
  not_configured: "Sign-in isn't set up on this site yet. Please try again soon.",
  callback: "We couldn't finish signing you in. Please try again.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const next = safeNext(one(sp.next));
  if (await optionalUser()) redirect(next);
  const err = one(sp.error);
  const initialError = err ? ERRORS[err] ?? ERRORS.callback : undefined;
  const starting = next.startsWith("/onboarding");

  return (
    <SiteShell width="narrow">
      <div className="mx-auto max-w-md">
        <h1 className="font-display text-3xl font-bold">{starting ? "Let's start your first goal" : "Welcome back"}</h1>
        <p className="mt-1 text-muted">{starting ? "Make a free account in a few seconds. Everything you add stays private until you choose to share it." : "Sign in to see your goals and your people."}</p>
        <Card className="mt-6">
          <LoginForm next={next} initialError={initialError} />
        </Card>
        <p className="mt-4 text-xs text-muted">
          By continuing you agree to the <Link className="underline" href="/legal/terms">Terms</Link> and <Link className="underline" href="/legal/privacy">Privacy notice</Link>.
        </p>
      </div>
    </SiteShell>
  );
}
