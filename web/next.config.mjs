import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n.ts");

const isDev = process.env.NODE_ENV === "development";

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data: https://basemaps.cartocdn.com",
  "img-src 'self' data: blob: https://basemaps.cartocdn.com https://server.arcgisonline.com",
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "connect-src 'self' https://photon.komoot.io https://server.arcgisonline.com https://basemaps.cartocdn.com https://*.basemaps.cartocdn.com",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // Bundle the TTF fonts into the PDF route's serverless function so
  // fs.readFileSync finds them at runtime on Vercel.
  outputFileTracingIncludes: {
    "/api/report/pdf": ["./src/assets/*.ttf"],
  },
  async headers() {
    return [{
      source: "/:path*",
      headers: SECURITY_HEADERS,
    }];
  },
};

export default withNextIntl(nextConfig);
