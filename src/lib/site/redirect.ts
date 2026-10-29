/**
 * Only allow same-site relative paths as post-login destinations, so a crafted
 * ?next= cannot bounce someone to another site ("//evil.com", "/\evil.com").
 */
export function safeNext(raw: string | null | undefined, fallback = "/app"): string {
  if (!raw || typeof raw !== "string") return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  // Backslashes and control characters can be normalized into "//" by browsers.
  if (/[\\\u0000-\u001f]/.test(raw)) return fallback;
  return raw.slice(0, 500);
}
