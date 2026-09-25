import type { MetadataRoute } from "next";

const SITE_URL = "https://kamvcesku.cz";
const LOCALES = ["cs", "en", "ru"];

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/map", "/compare", "/report", "/methodology", "/privacy"];

  return pages.flatMap((page) =>
    LOCALES.map((locale) => ({
      url: `${SITE_URL}/${locale}${page}`,
      lastModified: new Date(),
      changeFrequency: page === "" ? ("weekly" as const) : ("monthly" as const),
      priority: page === "" ? 1 : page === "/report" ? 0.9 : 0.7,
    })),
  );
}
