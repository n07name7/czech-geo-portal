// Payment config. Lives in "mock mode" until real Stripe keys are set as
// env vars - then the same flow switches to live Checkout with no code
// changes. Mock mode lets the whole purchase → PDF flow be tested without
// money or accounts.

export const REPORT_PRICE_CZK = 99;
export const SUBSCRIPTION_PRICE_CZK = 199; // per month, "Pro" plan (realtors)

export const stripeSecret = process.env.STRIPE_SECRET_KEY ?? "";
export const stripePublic = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

/** Real Stripe is wired only when a secret key is present (server-side). */
export const PAYMENTS_LIVE = stripeSecret.startsWith("sk_");

// Payment wiring is intentionally disabled in this beta. A valid Stripe key is
// NOT enough to sell reports: launch needs a durable entitlement record, a
// verified webhook and a purchase-recovery path. Keep the product free until
// those pieces are implemented and independently tested.
export const PAYMENTS_VISIBLE = false;

export function canVerifyLiveSession(
  session: string | null,
  paymentsVisible = PAYMENTS_VISIBLE,
  paymentsLive = PAYMENTS_LIVE
): boolean {
  return paymentsVisible && paymentsLive && !!session?.startsWith("cs_");
}
