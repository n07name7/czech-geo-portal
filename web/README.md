# Kam v Česku? — web application

Address-first Czech location intelligence for people choosing where to rent or buy. The product compares the surroundings of a specific address using Czech open data; it does not inspect the building or provide legal real-estate due diligence.

## Current product state

This directory contains the isolated v2 beta. It is intentionally not linked to the existing production Vercel project.

Working flows:

- localized Czech, English and Russian landing pages;
- address search through Photon/OpenStreetMap;
- address report with profile-specific score and decision summary;
- two-address comparison with concrete criterion differences;
- interactive H3/PMTiles map;
- free beta PDF preview;
- transparent methodology, source periods and privacy disclosure.

Payments are deliberately disabled. Do not advertise or accept payment until the entitlement/webhook/recovery requirements in `docs/STRIPE_SETUP.md` are complete and independently tested.

## Coverage

Scored data currently covers eight cities:

- Praha
- Brno
- Ostrava
- Plzeň
- Liberec
- Olomouc
- České Budějovice
- Hradec Králové

An address can geocode outside these cities, but the report must show the out-of-coverage state rather than inventing a score.

## Data model and limitations

The primary map consists of H3 cells carrying normalized scores. Most scores are relative within a city, so a score of 80 means the location compares well with other covered cells in that city; it is not an absolute Czech-wide rating.

Static and periodically refreshed sources include MŠMT/RÚIAN, ÚZIS, Policie ČR, MZ ČR noise maps, ČHMÚ, CERMAT and the MF ČR rent map. Live address lookups use Photon, OpenStreetMap/Overpass, Valhalla and CENIA. Exact source periods and interpretation limits are displayed at `/<locale>/methodology`.

Nearby “minutes” are straight-line estimates, not walking routes. Safety is a relative incident-density signal and does not account for footfall or incident severity. The report is not an official document or a guarantee that risk is absent.

## Local setup

Requirements:

- Node.js compatible with the locked Next.js version
- npm

```bash
npm ci
npm test
npm run build
npm run dev
```

For a production-mode local QA run using the generated datasets in
`../etl/output/cities` (without R2 or Vercel):

```bash
npm run build
npm run start:local -- -p 3300
```

Open `http://localhost:3300/cs`, `/en` or `/ru`.

Production-style local run:

```bash
npm run build
npm run start -- -p 3300
```

## Environment

```dotenv
# Client-visible PMTiles base. The local fallback uses the allowlisted proxy.
NEXT_PUBLIC_R2_BASE_URL=/api/pmtiles

# Server-only credential-free HTTPS origin used by /api/pmtiles and authoritative
# PDF score verification. It must support bounded HTTP Range responses.
R2_DATA_BASE_URL=

# Required for free beta PDF preview; random and at least 32 characters.
REPORT_PREVIEW_SECRET=

# Rate limiting keys clients by x-forwarded-for ONLY when set to exactly
# "true". Enable behind an ingress that overwrites forwarding headers (the
# platform proxy must not pass client-supplied values through) and verify the
# header carries a single plain IP; otherwise every client shares one bucket.
TRUST_PROXY_HEADERS=

# Keep Stripe values unset in beta. Keys alone do NOT make payments safe.
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

Do not commit `.env.local` or secrets.

## Quality gates

Run before every preview deploy:

```bash
npm test
npx tsc --noEmit
npm run build
npm audit --omit=dev
```

Then smoke-test:

- `/cs`, `/en`, `/ru`;
- report restored from address/lat/lon query parameters;
- language switching preserves report parameters;
- two real addresses in comparison;
- map tiles and `averages.json` return successfully;
- upstream failure is displayed as unavailable data, not “no risk”;
- PDF preview waits for all source attempts; unavailable optional live sections
  are omitted with an explicit warning instead of being reported as "no risk".

## Important paths

- `src/app/[locale]/report` — single-address decision report
- `src/app/[locale]/compare` — two-address comparison
- `src/app/[locale]/methodology` — methodology and source periods
- `src/app/[locale]/privacy` — beta privacy/data disclosure
- `src/app/api` — upstream proxy and PDF routes
- `src/lib/report-insights.ts` — profile scoring and deterministic explanation
- `src/lib/payment.ts` — payment kill switch

## Deployment safety

Create a separate Vercel project for v2 preview. Do not reconnect this workspace to the current production project. Verify environment variables, PMTiles range requests, serverless timeouts and the complete browser flow on the preview URL before any production promotion.
