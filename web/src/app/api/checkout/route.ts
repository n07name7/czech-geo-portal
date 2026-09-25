import { type NextRequest, NextResponse } from "next/server";
import {
  PAYMENTS_LIVE,
  PAYMENTS_VISIBLE,
  REPORT_PRICE_CZK,
  SUBSCRIPTION_PRICE_CZK,
  stripeSecret,
} from "../../../lib/payment";
import { BodyTooLargeError, readLimitedJson } from "../_lib/request-protection";

// Creates a Checkout Session only after the durable-entitlement rollout enables payments.
export async function POST(req: NextRequest) {
  // Fail closed before touching an attacker-controlled request body.
  if (!PAYMENTS_VISIBLE || !PAYMENTS_LIVE) {
    return NextResponse.json({ error: "payments_unavailable" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await readLimitedJson(req, 8_192) as Record<string, unknown>;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof BodyTooLargeError ? "payload_too_large" : "bad_body" },
      { status: error instanceof BodyTooLargeError ? 413 : 400 },
    );
  }
  const { mode, locale } = body;
  if (mode !== "payment" && mode !== "subscription")
    return NextResponse.json({ error: "invalid_mode" }, { status: 400 });
  const kind = mode === "subscription" ? "subscription" : "payment";

  const origin = req.nextUrl.origin;
  const loc = locale === "en" || locale === "ru" ? locale : "cs";

  // ── Live Stripe Checkout ──────────────────────────────────────────────
  const amount = (kind === "subscription" ? SUBSCRIPTION_PRICE_CZK : REPORT_PRICE_CZK) * 100;
  const successParams = new URLSearchParams({ paid: "{CHECKOUT_SESSION_ID}" });

  const form = new URLSearchParams({
    mode: kind,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "czk",
    "line_items[0][price_data][product_data][name]":
      kind === "subscription" ? "Kam v Česku Pro" : "Report podle adresy",
    "line_items[0][price_data][unit_amount]": String(amount),
    success_url: `${origin}/${loc}/report?${successParams.toString()}`,
    cancel_url: `${origin}/${loc}/report`,
  });
  if (kind === "subscription") {
    form.set("line_items[0][price_data][recurring][interval]", "month");
  }

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeSecret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });
  if (!res.ok) {
    return NextResponse.json({ error: "stripe_error" }, { status: 502 });
  }
  const session = await res.json();
  return NextResponse.json({ url: session.url });
}
