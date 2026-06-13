import { type NextRequest, NextResponse } from "next/server";
import {
  PAYMENTS_LIVE,
  REPORT_PRICE_CZK,
  SUBSCRIPTION_PRICE_CZK,
  stripeSecret,
  mockSessionId,
} from "@/lib/payment";

// Creates a Checkout Session and returns { url } to redirect to.
// Mock mode (no Stripe keys): returns a local URL that marks the report
// as paid so the full flow is testable end-to-end.
export async function POST(req: NextRequest) {
  const { mode, address, locale } = await req.json().catch(() => ({}));
  const kind = mode === "subscription" ? "subscription" : "payment";
  const origin = req.nextUrl.origin;
  const loc = typeof locale === "string" ? locale : "cs";

  if (!PAYMENTS_LIVE) {
    const session = mockSessionId();
    const params = new URLSearchParams({ paid: session });
    if (address) params.set("address", String(address));
    return NextResponse.json({
      url: `${origin}/${loc}/report?${params.toString()}`,
      mock: true,
    });
  }

  // ── Live Stripe Checkout ──────────────────────────────────────────────
  const amount = (kind === "subscription" ? SUBSCRIPTION_PRICE_CZK : REPORT_PRICE_CZK) * 100;
  const successParams = new URLSearchParams({ paid: "{CHECKOUT_SESSION_ID}" });
  if (address) successParams.set("address", String(address));

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
