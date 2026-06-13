import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cache-bust the PMTiles URLs on every build: a fresh build id changes the
  // ?v= query so browsers/CDN refetch instead of serving a stale data file.
  env: {
    NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ?? String(Date.now()),
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
