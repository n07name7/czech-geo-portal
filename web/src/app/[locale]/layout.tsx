import "../globals.css";
import { DM_Serif_Display, Outfit } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import type { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};
import type { ReactNode } from "react";

const dmSerif = DM_Serif_Display({
  subsets: ["latin", "latin-ext"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin", "latin-ext"],
  variable: "--font-body",
  display: "swap",
});

const META: Record<string, { title: string; description: string }> = {
  cs: {
    title: "Kam v Česku? — Kde bydlet podle kvality okolí",
    description: "Porovnejte čtvrti podle škol, klidu, bezpečnosti, dopravy a dalších vrstev a najděte tu pravou pro sebe.",
  },
  en: {
    title: "Kam v Česku? — Where to live by neighbourhood quality",
    description: "Compare neighbourhoods by schools, quiet, safety, transport and more, and find the right one for you.",
  },
  ru: {
    title: "Kam v Česku? — Где жить по качеству района",
    description: "Сравнивайте районы по школам, тишине, безопасности, транспорту и другому — и найдите свой.",
  },
};

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const meta = META[locale] ?? META.cs;
  return {
    title: meta.title,
    description: meta.description,
    alternates: { languages: { cs: "/cs", en: "/en", ru: "/ru" } },
    openGraph: { title: meta.title, description: meta.description },
  };
}

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  const messages = await getMessages();
  return (
    <html lang={locale} className={`${dmSerif.variable} ${outfit.variable}`}>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
