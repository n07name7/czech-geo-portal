import { expect, it, vi } from "vitest";
import * as registration from "./pmtiles-protocol";

it("shares one protocol across concurrent maps and remounts", () => {
  const add = vi.fn();
  expect(registration.ensurePmtilesProtocol).toBeTypeOf("function");
  const first = registration.ensurePmtilesProtocol(add);
  expect(registration.ensurePmtilesProtocol(add)).toBe(first);
  expect(registration.ensurePmtilesProtocol(add)).toBe(first);
  expect(add).toHaveBeenCalledExactlyOnceWith("pmtiles", first.tile);
});
