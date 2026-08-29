# Kam v Česku? v2 — launch notes

This copy is an isolated product workspace:

- Path: `/home/ivan/czech-geo-portal-next`
- Branch: `redesign/v2`
- Git remotes: none
- Vercel linkage: intentionally removed

It is safe to iterate here without changing the currently deployed site.

## What v2 now changes for a visitor

1. **An address starts the product.** The landing page has an address search with Czech geocoding suggestions and takes the visitor straight into a report.
2. **A score has a purpose.** In the report, people can select Balanced, Family, Renting or Student. The weighted score, strengths, watch-outs and verdict change to match that decision.
3. **Evidence is visible before a PDF.** Rent relative to the city and named nearby places are shown on the web report instead of being hidden only in a download.
4. **Two homes can be compared.** `/cs/compare` lets a visitor enter two addresses, view them side-by-side and see a recommendation based on the selected profile. Each address links to its detailed report.

## Verified locally

- `npm test`: 8 assertions passed
- `npm run build`: production build passed
- `/cs`, `/cs/compare`, and a URL-restored report returned HTTP success locally
- `/api/nearby` returned real nearby categories for a central Prague coordinate

## Before a public paid launch

Do not advertise paid reports until these are completed:

1. Configure valid `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` in the future deployment environment, then make a real low-value test purchase.
2. Verify the full chain on the deployment: checkout → return URL → payment verification → PDF download.
3. Add a privacy policy, terms, contact email and data-scope disclaimer appropriate for Czech consumers.
4. Decide the offer to validate first. Recommended first experiment: one address free, a two-address decision report at 199–299 Kč. Do not claim that current beta pricing is final.
5. Create a separate Vercel project/preview deployment for this v2 copy; do not reconnect it to the production project by accident.

## Suggested next build phases

- Make the comparison output include concrete differences (rent, risks, nearby amenities), not just weighted score.
- Carry the selected profile and decision summary into the PDF.
- Add a sample report page and instrumentation for address searches, report completion, comparison start and checkout click.
- Build an explicit B2B page for real-estate agents only after testing the B2C comparison flow with real users.
