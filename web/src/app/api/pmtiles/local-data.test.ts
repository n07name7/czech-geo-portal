import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { localDataResponse } from "./local-data";

let dir = "";
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "kamvcesku-data-"));
  await writeFile(join(dir, "schools.pmtiles"), Buffer.from("0123456789"));
  await writeFile(join(dir, "averages.json"), Buffer.from('{"praha":{}}'));
});
afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

describe("local PMTiles data backend", () => {
  it("returns only the requested archive range", async () => {
    const response = await localDataResponse(dir, "schools.pmtiles", "bytes=2-5");
    expect(response?.status).toBe(206);
    expect(response?.headers.get("content-range")).toBe("bytes 2-5/10");
    expect(await response?.text()).toBe("2345");
  });

  it("rejects an archive request without a bounded range", async () => {
    expect((await localDataResponse(dir, "schools.pmtiles", null))?.status).toBe(416);
  });

  it("serves the small averages document without a range", async () => {
    const response = await localDataResponse(dir, "averages.json", null);
    expect(response?.status).toBe(200);
    expect(await response?.json()).toEqual({ praha: {} });
  });

  it("returns null when the configured local file does not exist", async () => {
    expect(await localDataResponse(dir, "missing.pmtiles", "bytes=0-1")).toBeNull();
  });
});
