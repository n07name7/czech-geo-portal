import "../globals.css";
import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import type { Metadata } from "next";
import type { ReactNode } from "react";

const inter = Inter({ subsets: ["latin", "latin-ext"] });

const META: Record<string, { title: string; description: string }> = {
  cs: {
    title: "Kam v Česku? | Infrastrukturní mapa",
    description: "Porovnejte čtvrti v Praze podle škol, parků, dopravy a dalších vrstev.",
  },
  en: {
    title: "Where in Czechia? | Infrastructure map",
    description: "Compare Prague neighbourhoods by schools, parks, transport, and 6 more layers.",
  },
  ru: {
    title: "Куда в Чехии? | Карта инфраструктуры",
    description: "Сравнивайте районы Праги по школам, паркам, транспорту и 6 другим слоям.",
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
    alternates: {
      languages: { cs: "/cs", en: "/en", ru: "/ru" },
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
    },
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
    <html lang={locale} className={inter.className}>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
