import { describe, expect, it } from "vitest";
import { PAYMENTS_VISIBLE } from "./payment";

describe("beta payment safety", () => {
  it("does not expose checkout merely because environment keys exist", () => {
    expect(PAYMENTS_VISIBLE).toBe(false);
  });
});
