import { describe, expect, it } from "vitest";
import { isAllowedDataFile, normalizeByteRange } from "./proxy-policy";

describe("data proxy policy", () => {
  it("allows only application data artifacts", () => {
    expect(isAllowedDataFile("combined.pmtiles")).toBe(true);
    expect(isAllowedDataFile("averages.json")).toBe(true);
    expect(isAllowedDataFile("../package.json")).toBe(false);
    expect(isAllowedDataFile("release-notes.txt")).toBe(false);
    expect(isAllowedDataFile("nested/schools.pmtiles")).toBe(false);
  });

  it("accepts a bounded byte range and rejects unbounded or malformed ranges", () => {
    expect(normalizeByteRange("bytes=0-16383")).toBe("bytes=0-16383");
    expect(normalizeByteRange("bytes=100-")).toBeNull();
    expect(normalizeByteRange("bytes=0-99999999")).toBeNull();
    expect(normalizeByteRange("bytes=5-4")).toBeNull();
  });
});
