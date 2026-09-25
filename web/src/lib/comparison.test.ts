import { describe, expect, it } from "vitest";
import { compareAddresses } from "./comparison";

const familyFriendly = {
  schools: 0.9, kindergartens: 0.9, playgrounds: 0.8, clinics: 0.8, pharmacies: 0.7,
  transport: 0.5, parks: 0.85, sports: 0.6, shops: 0.7, quiet: 0.75, safety: 0.8,
  highschool: 0.6, air: 0.7,
};
const transitHeavy = { ...familyFriendly, schools: 0.35, kindergartens: 0.3, playgrounds: 0.25, parks: 0.3, quiet: 0.25, transport: 0.95 };

describe("address comparison", () => {
  it("recommends the address with a better family fit", () => {
    const result = compareAddresses({ a: familyFriendly, b: transitHeavy, profile: "family", locale: "cs" });

    expect(result.winner).toBe("a");
    expect(result.reason).toContain("rodinu");
    expect(result.a).toBeGreaterThan(result.b);
  });

  it("flags a close decision rather than inventing a winner", () => {
    const result = compareAddresses({ a: familyFriendly, b: { ...familyFriendly, parks: 0.84 }, profile: "balanced", locale: "en" });

    expect(result.winner).toBe("tie");
    expect(result.reason).toContain("very close");
  });

  it("returns a Russian recommendation for the Russian locale", () => {
    const result = compareAddresses({ a: familyFriendly, b: transitHeavy, profile: "family", locale: "ru" });

    expect(result.winner).toBe("a");
    expect(result.reason).toContain("Адрес A");
    expect(result.reason).toContain("семьи");
  });

  it("does not declare a winner for scores normalized in different cities", () => {
    const result = compareAddresses({
      a: familyFriendly,
      b: transitHeavy,
      profile: "family",
      locale: "en",
      comparable: false,
    });
    expect(result.winner).toBe("incomparable");
    expect(result.reason).toContain("different cities");
  });
});
