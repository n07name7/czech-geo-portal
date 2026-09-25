import "../globals.css";
import { DM_Serif_Display, Outfit } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import type { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b0d12",
};
import type { ReactNode } from "react";
import SiteFooter from "@/components/SiteFooter";

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

const META: Record<string, { title: string; description: string; locale: string }> = {
  cs: {
    title: "Kam v Česku? - Kde bydlet podle kvality okolí",
    description: "Porovnejte čtvrti podle škol, klidu, bezpečnosti, dopravy a dalších vrstev a najděte tu pravou pro sebe.",
    locale: "cs_CZ",
  },
  en: {
    title: "Kam v Česku? - Where to live by neighbourhood quality",
    description: "Compare neighbourhoods by schools, quiet, safety, transport and more, and find the right one for you.",
    locale: "en_US",
  },
  ru: {
    title: "Kam v Česku? - Где жить по качеству района",
    description: "Сравнивайте районы по школам, тишине, безопасности, транспорту и другому - и найдите свой.",
    locale: "ru_RU",
  },
};

const SITE_URL = "https://kamvcesku.cz";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const meta = META[locale] ?? META.cs;
  return {
    metadataBase: new URL(SITE_URL),
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: `/${locale}`,
      languages: { cs: "/cs", en: "/en", ru: "/ru" },
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: `${SITE_URL}/${locale}`,
      siteName: "Kam v Česku?",
      type: "website",
      locale: meta.locale,
      images: [{ url: "/og-image.png", width: 1200, height: 630, alt: meta.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.description,
      images: ["/og-image.png"],
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const messages = await getMessages();
  return (
    <html lang={locale} className={`${dmSerif.variable} ${outfit.variable}`}>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
          <SiteFooter />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
