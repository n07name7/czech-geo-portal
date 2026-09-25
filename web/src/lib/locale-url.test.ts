import { describe, expect, it } from "vitest";
import { switchLocaleInUrl } from "./locale-url";

describe("switchLocaleInUrl", () => {
  it("preserves report query parameters while replacing the locale", () => {
    expect(
      switchLocaleInUrl(
        "/cs/report",
        "address=V%C3%A1clavsk%C3%A9+n%C3%A1m%C4%9Bst%C3%AD&lat=50.0816&lon=14.4272&profile=family",
        "ru",
      ),
    ).toBe(
      "/ru/report?address=V%C3%A1clavsk%C3%A9+n%C3%A1m%C4%9Bst%C3%AD&lat=50.0816&lon=14.4272&profile=family",
    );
  });

  it("handles the localized home page without adding an empty query", () => {
    expect(switchLocaleInUrl("/en", "", "cs")).toBe("/cs");
  });
});
