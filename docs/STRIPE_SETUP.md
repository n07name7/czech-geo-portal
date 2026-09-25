# Payments — blocked until durable entitlement exists

Payments are intentionally disabled in the v2 beta (`PAYMENTS_VISIBLE = false`). Adding Stripe keys is not sufficient and must not expose checkout.

## Why checkout must remain disabled

The historical flow used a Checkout Session ID as a transferable bearer entitlement. It was not bound to a report, address pair, amount, customer or refund state, and it had no trusted webhook or recovery path. The PDF endpoint also accepted client-computed report data. That architecture is suitable only for the current free preview, not a paid product.

## Required architecture before any paid launch

1. Define one initial product: a two-address decision report. Do not launch the unfinished Pro subscription.
2. Create a server-generated opaque `reportId` before checkout.
3. Store the normalized two-address input and server-derived report data against that ID.
4. Create Stripe Checkout with explicit product, amount, currency and `reportId` metadata.
5. Process signed Stripe webhooks idempotently and persist payment/refund state.
6. Grant access only when product, amount, currency and trusted payment state match the requested `reportId`.
7. Generate the paid PDF from trusted server data, not client-supplied scores, rent, flags or map images.
8. Provide purchase recovery through verified email or a signed, revocable link.
9. Add operator identity, contact, Terms, refund/complaint handling, digital-content consent and the final privacy notice.
10. Complete a low-value Stripe test-mode purchase on the isolated preview deployment, then test refund/revocation and recovery.
11. Obtain an independent security review before changing `PAYMENTS_VISIBLE`.

## Mandatory tests

- report A entitlement cannot download report B;
- wrong product, amount or currency is rejected;
- unpaid, expired, refunded or disputed payments are rejected;
- duplicate webhooks are idempotent;
- forged client scores and map payloads never enter the paid PDF;
- oversized/malformed payloads receive bounded 4xx responses;
- purchase can be recovered after browser state and URL parameters are lost;
- checkout and PDF generation are rate-limited;
- CS/EN/RU legal and price copy match the actual transaction.

## Beta behavior

With payments hidden, the report page requests a short-lived HMAC preview token using the selected address coordinates. The server resolves the canonical static scores directly from the configured PMTiles archive and binds the token to those scores; client-supplied scores are rejected at token issuance. Arbitrary `mock_*` strings are rejected. PDF requests are size-limited, deeply validated, rate-limited and capped at two concurrent renders per application instance. Optional live sections and client-rendered map images are still not a paid-grade server trust boundary.

Set `REPORT_PREVIEW_SECRET` to the same random value (minimum 32 characters) on every preview deployment instance. Generate one without printing it into source control, for example with `openssl rand -hex 32`, then store it only in the hosting provider's encrypted environment settings. If the secret is absent or too short, preview-token issuance fails closed with HTTP 503.

Even if Stripe keys accidentally exist in the environment, `PAYMENTS_VISIBLE = false` prevents live Stripe entitlement verification and checkout exposure. The preview token is not a paid entitlement and must never be reused for the future paid product.
