import "../globals.css";
import { DM_Serif_Display, Outfit } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import type { Metadata } from "next";
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
    title: "Kam v Česku? — Infrastrukturní mapa Prahy",
    description: "Porovnejte čtvrti v Praze podle škol, parků, dopravy a dalších 9 vrstev infrastruktury.",
  },
  en: {
    title: "Where in Czechia? — Prague infrastructure map",
    description: "Compare Prague neighbourhoods by schools, parks, transport, and 9 infrastructure layers.",
  },
  ru: {
    title: "Куда в Чехии? — Карта инфраструктуры Праги",
    description: "Сравнивайте районы Праги по школам, паркам, транспорту и 9 другим слоям.",
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
