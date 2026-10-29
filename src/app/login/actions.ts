"use server";
import { redirect } from "next/navigation";
import * as z from "zod/v4";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { applyPendingPurchases } from "@/lib/commerce/purchases";
import { safeNext } from "@/lib/site/redirect";

export interface AuthState {
  error?: string;
  message?: string;
  email?: string; // echoed back so a failed submit keeps what was typed
}

const Email = z.email({ error: "Enter an email like you@example.com." });

const callbackUrl = (next: string) => `${env.appUrl}/auth/callback?next=${encodeURIComponent(next)}`;

function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "That email and password don't match. Try again, or get a sign-in link instead.";
  if (m.includes("not confirmed")) return "Please confirm your email first. Check your inbox for the link we sent.";
  if (m.includes("already registered") || m.includes("already exists")) return "There's already an account with that email. Sign in instead.";
  if (m.includes("rate") || m.includes("too many") || m.includes("security purposes")) return "Too many tries in a row. Wait a minute, then try again.";
  if (m.includes("password")) return "Passwords need at least 8 characters.";
  if (m.includes("provider is not enabled")) return "Google sign-in isn't switched on yet. Use an email link for now.";
  return "Something went wrong signing you in. Please try again.";
}

const configured = () => !!env.supabaseUrl && !!env.supabaseAnonKey;
const NOT_READY: AuthState = { error: "Sign-in isn't set up on this site yet. Please try again soon." };

export async function sendMagicLink(_prev: AuthState, form: FormData): Promise<AuthState> {
  if (!configured()) return NOT_READY;
  const typed = String(form.get("email") ?? "").trim().toLowerCase().slice(0, 254);
  const email = Email.safeParse(typed);
  if (!email.success) return { error: email.error.issues[0].message, email: typed };
  const next = safeNext(String(form.get("next") ?? ""));
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ email: email.data, options: { emailRedirectTo: callbackUrl(next), shouldCreateUser: true } });
  if (error) return { error: friendly(error.message), email: typed };
  return { message: `Check ${email.data} for a sign-in link. It works once and expires in an hour.` };
}

const PasswordForm = z.object({
  email: Email,
  password: z.string().min(8, { error: "Passwords need at least 8 characters." }).max(72, { error: "That password is too long (72 characters max)." }),
  mode: z.enum(["signin", "signup"]),
});

export async function passwordAuth(_prev: AuthState, form: FormData): Promise<AuthState> {
  if (!configured()) return NOT_READY;
  const typed = String(form.get("email") ?? "").trim().toLowerCase().slice(0, 254);
  const parsed = PasswordForm.safeParse({
    email: typed,
    password: String(form.get("password") ?? ""),
    mode: form.get("mode") === "signup" ? "signup" : "signin",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message, email: typed };
  const { email, password, mode } = parsed.data;
  const next = safeNext(String(form.get("next") ?? ""));
  const supabase = await createClient();

  if (mode === "signin") {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return { error: friendly(error?.message ?? ""), email };
    await applyPendingPurchases(data.user.id, data.user.email);
    redirect(next);
  }

  const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: callbackUrl(next) } });
  if (error) return { error: friendly(error.message), email };
  if (data.session && data.user) {
    await applyPendingPurchases(data.user.id, data.user.email);
    redirect(next);
  }
  return { email, message: `Almost there. We sent a confirmation link to ${email}; open it to finish creating your account.` };
}

export async function googleSignIn(form: FormData): Promise<void> {
  const next = safeNext(String(form.get("next") ?? ""));
  if (!configured()) redirect(`/login?next=${encodeURIComponent(next)}&error=not_configured`);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callbackUrl(next) } });
  if (error || !data.url) redirect(`/login?next=${encodeURIComponent(next)}&error=google`);
  redirect(data.url);
}
