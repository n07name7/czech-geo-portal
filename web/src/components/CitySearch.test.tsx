import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import CitySearch from "./CitySearch";
import cs from "../../messages/cs.json";
import en from "../../messages/en.json";
import ru from "../../messages/ru.json";
import type { CityConfig } from "../lib/cities";

// The project preserves JSX for Next; Vitest's default transform is classic.
Object.assign(globalThis, { React });
const city = { id: "praha", name: "Praha" } as CityConfig;
describe("CitySearch localization", () => {
  it.each([
    ["cs", cs, "Hledat město…"],
    ["en", en, "Search cities…"],
    ["ru", ru, "Поиск города…"],
  ] as const)("uses the %s locale without changing callers", (locale, messages, label) => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale={locale} messages={messages} timeZone="Europe/Prague">
        <CitySearch cities={[city]} value={city} onChange={() => {}} />
      </NextIntlClientProvider>,
    );
    expect(html).toContain(`placeholder="${label}"`);
    expect(html).toContain(`aria-label="${label}"`);
  });

  it("localizes the empty state instead of hardcoding Czech", () => {
    const source = readFileSync(new URL("./CitySearch.tsx", import.meta.url), "utf8");
    expect(source).toContain('t("noResults")');
    expect(source).not.toContain("Nic nenalezeno");
  });
});
