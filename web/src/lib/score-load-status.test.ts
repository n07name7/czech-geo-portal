import { describe, expect, it } from "vitest";
import { scoreStatusMessageKey } from "./score-load-status";

describe("address score load status", () => {
  it("distinguishes loading, outside coverage, and an unavailable data source", () => {
    expect(scoreStatusMessageKey("loading")).toBe("scoreLoading");
    expect(scoreStatusMessageKey("outside")).toBe("scoreOutside");
    expect(scoreStatusMessageKey("unavailable")).toBe("scoreUnavailable");
    expect(scoreStatusMessageKey("ready")).toBeNull();
  });
});
