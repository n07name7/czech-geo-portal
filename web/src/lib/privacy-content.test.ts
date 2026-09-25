import { describe, expect, it } from "vitest";
import { getPrivacyContent } from "./privacy-content";

describe("privacy disclosure", () => {
  it("discloses every external service that may receive an address or coordinates", () => {
    const text = getPrivacyContent("en").sections.flatMap((section) => [section.title, ...section.paragraphs]).join(" ");
    for (const service of ["Photon", "OpenStreetMap", "Overpass", "Valhalla", "CENIA", "Vercel"]) {
      expect(text).toContain(service);
    }
  });

  it("does not pretend that payments or user accounts are active", () => {
    const content = getPrivacyContent("ru");
    const text = content.sections.flatMap((section) => section.paragraphs).join(" ");
    expect(text).toContain("Платежи отключены");
    expect(text).toContain("не создаёт учётные записи");
  });
});
