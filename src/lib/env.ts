// Central place for configuration. Server-only values are read lazily so a
// missing optional integration (email, push, Google) degrades instead of crashing.

export const env = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? "",
  vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
};

export function serverEnv() {
  return {
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    anthropicKey: process.env.ANTHROPIC_API_KEY ?? "",
    aiModel: process.env.GK_AI_MODEL ?? "claude-sonnet-5-5",
    googleClientId: process.env.GOOGLE_OAUTH_CLIENT_ID ?? "",
    googleClientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "",
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY ?? "",
    vapidSubject: process.env.VAPID_SUBJECT ?? "mailto:support@goalkin.app",
    resendKey: process.env.RESEND_API_KEY ?? "",
    emailFrom: process.env.GK_EMAIL_FROM ?? "GoalKin <hello@goalkin.app>",
    cronSecret: process.env.CRON_SECRET ?? "",
    ghlWebhookSecret: process.env.GHL_WEBHOOK_SECRET ?? "",
    adminEmails: (process.env.GK_ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
    checkout: {
      pro_monthly: process.env.GK_CHECKOUT_PRO_MONTHLY ?? "",
      pro_yearly: process.env.GK_CHECKOUT_PRO_YEARLY ?? "",
      circle: process.env.GK_CHECKOUT_CIRCLE ?? "",
      club: process.env.GK_CHECKOUT_CLUB ?? "",
      finish_the_year: process.env.GK_CHECKOUT_FINISH_THE_YEAR ?? "",
      new_year_reset: process.env.GK_CHECKOUT_NEW_YEAR_RESET ?? "",
    } as Record<string, string>,
  };
}
