# Activating payments (Phase C2)

The purchase flow is fully wired but **inactive** until Stripe keys are set.
Without keys the report page shows a disabled "Coming soon" button.

## To go live (test mode first)
1. Stripe account → test keys: https://dashboard.stripe.com/test/apikeys
2. Set env vars on the Vercel project `web`:
   - `STRIPE_SECRET_KEY=sk_test_...`                  (server — real Checkout)
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...` (shows the buy UI)
3. Redeploy. Report page offers: "Koupit PDF za 99 Kč" and "Předplatné Pro".
4. Test card: 4242 4242 4242 4242, any future date / CVC.
5. For real money, swap to live keys (sk_live_, pk_live_).

## How it works
- POST /api/checkout → Stripe Checkout Session; success → /<locale>/report?paid=<session>
- POST /api/report/pdf → verifies session is paid, returns PDF. Mock mode
  (no keys) accepts mock_… sessions for local testing only.
- Prices in src/lib/payment.ts (REPORT_PRICE_CZK, SUBSCRIPTION_PRICE_CZK).

## Note
Subscription processes payment but full "Pro" gating (accounts, saved
searches, unlimited reports) needs a later auth phase.
