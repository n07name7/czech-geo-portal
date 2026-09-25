import { describe, expect, it } from "vitest";
import { resolveRemoteArchiveUrl, resolveServerScores, tileCoordinates } from "./server-report-data";

describe("server report data", () => {
  it("computes stable z/x/y coordinates", () => {
    expect(tileCoordinates(50.0815867, 14.4271699, 14)).toEqual({ z: 14, x: 8848, y: 5550 });
  });

  it("accepts only credential-free HTTPS archive bases", () => {
    expect(resolveRemoteArchiveUrl("https://data.example.test/archive")).toBe("https://data.example.test/archive/combined.pmtiles");
    expect(resolveRemoteArchiveUrl("http://data.example.test")).toBeNull();
    expect(resolveRemoteArchiveUrl("https://user:pass@data.example.test")).toBeNull();
    expect(resolveRemoteArchiveUrl("https://data.example.test?token=secret")).toBeNull();
  });

  it("resolves authoritative scores from the local combined archive", async () => {
    const scores = await resolveServerScores(50.0815867, 14.4271699, {
      localDirectory: "../etl/output/cities",
    });
    expect(scores).not.toBeNull();
    expect(scores?.schools).toBeCloseTo(0.684, 3);
    expect(scores?.rent).toBe(405);
    expect(scores?.n_transport).toBe(98);
  });

  it("rejects coordinates outside Czechia before reading data", async () => {
    await expect(resolveServerScores(0, 0, { localDirectory: "/does/not/exist" })).rejects.toThrow("coordinates outside Czechia");
  });
});

describe("HttpRangeSource Content-Range validation", () => {
  // To test the validation, we instantiate the HttpRangeSource indirectly via
  // resolveServerScores with a mock fetch and a remote base URL.
  function setupMockFetch(contentRange: string, contentLength: string, bodyLength: number) {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(new Uint8Array(bodyLength), {
      status: 206,
      headers: {
        "content-range": contentRange,
        "content-length": contentLength,
      },
    });
    return () => { globalThis.fetch = originalFetch; };
  }

  it("rejects a Content-Range with mismatched start offset", async () => {
    const restore = setupMockFetch("bytes 999-1015/2000", "17", 17);
    try {
      await expect(resolveServerScores(50.08, 14.42, {
        remoteBaseUrl: "https://mock.test",
      })).rejects.toThrow(/content range/i);
    } finally {
      restore();
    }
  });

  it("rejects a Content-Range with no valid format", async () => {
    const restore = setupMockFetch("nonsense", "16", 16);
    try {
      await expect(resolveServerScores(50.08, 14.42, {
        remoteBaseUrl: "https://mock.test",
      })).rejects.toThrow(/content range/i);
    } finally {
      restore();
    }
  });
});
