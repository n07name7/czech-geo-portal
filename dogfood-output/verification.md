# Local verification

No Vercel operations or deployment performed.

Verified with real browser events and real data:
- Czech desktop: Václavské náměstí, Praha vs Česká, Brno: scores 54 and 55; comparison/recommendation displayed; both thematic maps rendered; archive requests 206; no captured JS exceptions or horizontal overflow.
- English desktop: Václavské náměstí vs Karlovo náměstí, Praha: 54 and 49; same-city recommendation and differences rendered; 206; no captured JS exceptions or overflow.
- Russian 390px: Praha vs Brno: 54 and 55, cross-city caveat, comparison rendered; 206; no captured JS exceptions or overflow.
- Russian detailed report: real scores, source data and isochrone maps.
- Real PDF UI export: preview-token 200, PDF 200. Saved kam-v-cesku-report.pdf, 3 A4 pages, 1167712 bytes. All three pages rasterized and visually inspected; content and maps present.

Fixes this continuation:
- Removed temporary debug hooks/logging.
- Completed visible-time timeout integration.
- Nearby lookup now allows one 30-second fetch (upstream query budget 25 seconds), instead of aborting useful queries at 8 seconds and using repeated attempts on HTTP failures.
- PDF validator accepts bounded city rent medians from averages.json. Previously actual report payload was rejected with 400 despite successful minimal unit fixtures.

Gates: 31 test files / 117 tests passed. Production build including lint/type check passed. git diff --check passed.

Remaining limitations / not a release sign-off:
- Public Overpass-dependent flags request timed out (504) on fresh report load; explicit retry succeeded, enabling PDF. External source reliability is not guaranteed.
- No exhaustive final independent security review, all-locale PDF visual QA, or complete browser matrix performed in this continuation.
- Payments remain disabled. Local data source does not repair the old remote R2 origin.
- Broad historic worktree remains uncommitted; no production replacement authorized.
