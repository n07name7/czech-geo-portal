import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const path = new URL("../app/[locale]/error.tsx", import.meta.url);

describe("localized route error boundary", () => {
  it("exists and offers a real reset action", () => {
    expect(existsSync(path)).toBe(true);
    const source = readFileSync(path, "utf8");
    expect(source).toContain('useTranslations("error")');
    expect(source).toContain("reset()");
    expect(source).toContain('role="alert"');
  });

  it("has matching localized copy", () => {
    for (const locale of ["cs", "en", "ru"]) {
      const messages = JSON.parse(readFileSync(new URL(`../../messages/${locale}.json`, import.meta.url), "utf8"));
      expect(messages.error).toMatchObject({ title: expect.any(String), description: expect.any(String), retry: expect.any(String) });
    }
  });
});
