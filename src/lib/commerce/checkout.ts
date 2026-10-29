// Checkout links: GoHighLevel order forms, with the signed-in person's email
// prefilled so the purchase webhook can match the account.

/** Append ?email= to a checkout URL. Returns null for an empty or invalid URL (never a dead link). */
export function checkoutHref(base: string | null | undefined, email?: string | null): string | null {
  if (!base) return null;
  let url: URL;
  try {
    url = new URL(base);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (email) url.searchParams.set("email", email);
  return url.toString();
}
