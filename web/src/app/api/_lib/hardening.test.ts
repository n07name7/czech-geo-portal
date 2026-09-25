import { describe, expect, it } from "vitest";
import { BoundedTtlCache } from "./hardening";

describe("BoundedTtlCache", () => {
  it("evicts the oldest entry when capacity is reached", () => {
    const cache = new BoundedTtlCache<number>(2, 60_000);

    cache.set("first", 1, 1_000);
    cache.set("second", 2, 1_001);
    cache.set("third", 3, 1_002);

    expect(cache.get("first", 1_003)).toBeUndefined();
    expect(cache.get("second", 1_003)).toBe(2);
    expect(cache.get("third", 1_003)).toBe(3);
    expect(cache.size).toBe(2);
  });
});
