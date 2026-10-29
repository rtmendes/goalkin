// GoHighLevel purchase webhook payloads differ by trigger (order form, payment
// received, custom workflow webhook). Accept the common shapes and normalize.
import * as z from "zod/v4";
import { mapProduct, type ProductKey } from "@/lib/commerce/products";

export interface ParsedPurchase {
  email: string;
  product: ProductKey | null; // null = could not map; stored as "unknown:<name>" for follow-up
  productName: string;
  amount: number | null;
  currency: string;
  providerRef: string;
}

const Body = z.looseObject({});

const EMAIL_PATHS = ["email", "contact_email", "customer_email", "contact.email", "customer.email", "order.customer.email", "order.contact.email", "payment.customer.email"];
const PRODUCT_PATHS = [
  "product_key", "goalkin_product", "customData.product", "custom_data.product", "product", "product_name", "productName", "price_name", "priceName",
  "line_items.0.name", "line_items.0.title", "order.line_items.0.name", "order.line_items.0.title", "order.product_name",
  "payment.product_name", "payment.line_items.0.name", "items.0.name", "products.0.name",
];
const AMOUNT_PATHS = ["amount", "amount_paid", "total", "order_total", "payment.amount", "payment.total", "order.amount", "order.total", "line_items.0.price"];
const REF_PATHS = ["order_id", "orderId", "transaction_id", "transactionId", "payment_id", "paymentId", "invoice_id", "order.id", "order._id", "payment.id", "payment.transaction_id", "id", "_id"];
const CURRENCY_PATHS = ["currency", "order.currency", "payment.currency"];

function get(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const k of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = Array.isArray(cur) ? cur[Number(k)] : (cur as Record<string, unknown>)[k];
  }
  return cur;
}

function firstString(obj: unknown, paths: string[]): string | null {
  for (const p of paths) {
    const v = get(obj, p);
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
    // { product: { name: "..." } }
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const name = (v as Record<string, unknown>).name ?? (v as Record<string, unknown>).title;
      if (typeof name === "string" && name.trim()) return name.trim();
    }
  }
  return null;
}

export function parseAmount(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : null;
  if (typeof v !== "string") return null;
  const n = Number(v.replace(/[^0-9.-]/g, ""));
  return v.trim() && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

const Email = z.email();

export type ParseResult = { ok: true; purchase: ParsedPurchase } | { ok: false; error: string };

export function parsePurchasePayload(input: unknown): ParseResult {
  const body = Body.safeParse(input);
  if (!body.success) return { ok: false, error: "Body must be a JSON object." };
  const data = body.data;
  const emailRaw = firstString(data, EMAIL_PATHS);
  const email = emailRaw ? Email.safeParse(emailRaw.toLowerCase()) : null;
  if (!email?.success) return { ok: false, error: "Missing or invalid email." };
  const providerRef = firstString(data, REF_PATHS);
  if (!providerRef || providerRef.length > 200) return { ok: false, error: "Missing order or transaction id." };
  const productName = firstString(data, PRODUCT_PATHS);
  if (!productName) return { ok: false, error: "Missing product." };
  let amount: number | null = null;
  for (const p of AMOUNT_PATHS) {
    amount = parseAmount(get(data, p));
    if (amount != null) break;
  }
  const currency = (firstString(data, CURRENCY_PATHS) ?? "USD").toUpperCase().slice(0, 3);
  return {
    ok: true,
    purchase: { email: email.data, product: mapProduct(productName), productName: productName.slice(0, 200), amount, currency, providerRef },
  };
}
