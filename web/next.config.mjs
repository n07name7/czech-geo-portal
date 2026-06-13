import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Bundle the TTF fonts into the PDF route's serverless function so
  // fs.readFileSync finds them at runtime on Vercel.
  experimental: {
    outputFileTracingIncludes: {
      "/api/report/pdf": ["./src/assets/*.ttf"],
    },
  },
};

export default withNextIntl(nextConfig);
