import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

beforeEach(() => { process.env.R2_DATA_BASE_URL = "https://data.example.test"; });
afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.R2_DATA_BASE_URL;
  delete process.env.PMTILES_LOCAL_DIR;
});

function makeRequest(file: string, range?: string) {
  const headers = range ? { range } : undefined;
  return new NextRequest(`http://localhost/api/pmtiles/${file}`, { headers });
}

const params = (file: string) => ({ params: Promise.resolve({ path: [file] }) });

describe("PMTiles proxy route", () => {
  it("fails closed without a configured data source", async () => {
    delete process.env.R2_DATA_BASE_URL;
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const response = await GET(makeRequest("schools.pmtiles", "bytes=0-15"), params("schools.pmtiles"));
    expect(response.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("rejects an archive request without a bounded Range before fetching upstream", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const response = await GET(makeRequest("schools.pmtiles"), params("schools.pmtiles"));
    expect(response.status).toBe(416);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an upstream that ignores the requested archive range", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Uint8Array(16), { status: 200, headers: { "content-length": "16" } })
    );
    const response = await GET(
      makeRequest("schools.pmtiles", "bytes=0-15"),
      params("schools.pmtiles")
    );
    expect(response.status).toBe(502);
  });

  it("rejects an archive response larger than the requested range", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Uint8Array(32), {
        status: 206,
        headers: { "content-length": "32", "content-range": "bytes 0-31/100" },
      })
    );
    const response = await GET(
      makeRequest("schools.pmtiles", "bytes=0-15"),
      params("schools.pmtiles")
    );
    expect(response.status).toBe(502);
  });

  it("maps an upstream timeout to 504", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new DOMException("timed out", "AbortError")
    );
    const response = await GET(
      makeRequest("schools.pmtiles", "bytes=0-15"),
      params("schools.pmtiles")
    );
    expect(response.status).toBe(504);
  });
});
