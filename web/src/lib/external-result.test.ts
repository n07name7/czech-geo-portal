import { describe, expect, it } from "vitest";
import { readExternalResult } from "./external-result";

describe("readExternalResult", () => {
  it("keeps a successful empty result distinguishable from an upstream failure", async () => {
    await expect(readExternalResult(new Response("{}", { status: 200 }))).resolves.toEqual({ status: "available", data: {} });
    await expect(readExternalResult(new Response('{"error":"upstream unavailable"}', { status: 502 }))).resolves.toEqual({ status: "unavailable", data: null });
  });

  it("treats malformed success payloads as unavailable", async () => {
    await expect(readExternalResult(new Response("not-json", { status: 200 }))).resolves.toEqual({ status: "unavailable", data: null });
  });
});
