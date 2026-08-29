// Payment config. Lives in "mock mode" until real Stripe keys are set as
// env vars — then the same flow switches to live Checkout with no code
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

/** A session id we accept as paid. In mock mode any "mock_…" passes. */
export function isPaidSession(session: string | null): boolean {
  if (!session) return false;
  if (!PAYMENTS_LIVE) return session.startsWith("mock_");
  // live verification happens server-side via the Stripe API (checkout route)
  return session.startsWith("cs_");
}

export function mockSessionId(): string {
  return `mock_${Date.now().toString(36)}`;
}
