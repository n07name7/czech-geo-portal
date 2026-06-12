import createMiddleware from "next-intl/middleware";

export default createMiddleware({
  locales: ["cs", "en", "ru"],
  defaultLocale: "cs",
  localeDetection: false,
});

export const config = { matcher: ["/((?!api|_next|.*\\..*).*)"] };
