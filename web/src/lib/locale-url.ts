export function switchLocaleInUrl(pathname: string, query: string, locale: string): string {
  const segments = pathname.split("/");
  if (segments.length < 2) return pathname;
  segments[1] = locale;
  const localizedPath = segments.join("/") || `/${locale}`;
  return query ? `${localizedPath}?${query}` : localizedPath;
}
