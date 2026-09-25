import { describe, expect, it } from "vitest";
import { PAYMENTS_VISIBLE, canVerifyLiveSession } from "./payment";

describe("beta payment safety", () => {
  it("does not expose checkout merely because environment keys exist", () => {
    expect(PAYMENTS_VISIBLE).toBe(false);
  });

  it("never verifies Stripe sessions while the payment kill switch is hidden", () => {
    expect(canVerifyLiveSession("cs_live_session", false, true)).toBe(false);
    expect(canVerifyLiveSession("cs_live_session", true, true)).toBe(true);
    expect(canVerifyLiveSession("mock_preview", true, true)).toBe(false);
  });
});
