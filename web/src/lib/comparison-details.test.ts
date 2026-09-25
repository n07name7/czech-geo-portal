import { describe, expect, it } from "vitest";
import { buildComparisonDetails } from "./comparison-details";

describe("buildComparisonDetails", () => {
  it("treats lower rent as better and reports the concrete difference", () => {
    const rows = buildComparisonDetails({
      a: { rent: 310 },
      b: { rent: 350 },
    });
    expect(rows).toContainEqual(expect.objectContaining({ id: "rent", winner: "a", a: 310, b: 350, difference: 40 }));
  });

  it("treats higher normalized location scores as better", () => {
    const rows = buildComparisonDetails({
      a: { transport: 0.82 },
      b: { transport: 0.61 },
    });
    expect(rows).toContainEqual(expect.objectContaining({ id: "transport", winner: "a", difference: 21 }));
  });

  it("does not invent a winner for a negligible score difference", () => {
    const rows = buildComparisonDetails({
      a: { safety: 0.701 },
      b: { safety: 0.704 },
    });
    expect(rows).toContainEqual(expect.objectContaining({ id: "safety", winner: "tie" }));
  });

  it("omits criteria that are missing at either address", () => {
    const rows = buildComparisonDetails({ a: { air: 0.7 }, b: {} });
    expect(rows.some((row) => row.id === "air")).toBe(false);
  });

  it("does not assign score advantages across different city scales", () => {
    const rows = buildComparisonDetails({
      a: { transport: 0.9 },
      b: { transport: 0.2 },
      comparable: false,
    });
    expect(rows).toContainEqual(expect.objectContaining({ id: "transport", winner: "incomparable" }));
  });
});
