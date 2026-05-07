import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";

const LOCALES = ["cs", "en", "ru"] as const;
type SupportedLocale = typeof LOCALES[number];

export default getRequestConfig(async ({ requestLocale }) => {
  const resolvedLocale = await requestLocale;
  if (!resolvedLocale || !LOCALES.includes(resolvedLocale as SupportedLocale)) {
    notFound();
  }
  const locale = resolvedLocale as SupportedLocale;
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
