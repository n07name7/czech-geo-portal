import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cache-bust the PMTiles URLs: a unique build timestamp changes the ?v=
  // query on every deploy, so browsers/CDN refetch instead of serving a stale
  // data file. The ETL workflow re-triggers a deploy after publishing new
  // data, so a data-only update also gets a fresh id (commit SHA wouldn't
  // change on a data-only run and would leave the cache stale).
  env: {
    NEXT_PUBLIC_BUILD_ID: String(Date.now()),
  },
  // Bundle the TTF fonts into the PDF route's serverless function so
  // fs.readFileSync finds them at runtime on Vercel.
  experimental: {
    outputFileTracingIncludes: {
      "/api/report/pdf": ["./src/assets/*.ttf"],
    },
  },
};

export default withNextIntl(nextConfig);
