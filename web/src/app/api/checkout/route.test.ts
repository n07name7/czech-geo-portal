import { describe, expect, it, vi } from "vitest";
import { POST } from "./route";

describe("checkout kill switch", () => {
  it("rejects before parsing the request body while payments are hidden", async () => {
    const json = vi.fn(async () => ({ mode: "payment" }));
    const response = await POST({ json } as never);
    expect(response.status).toBe(503);
    expect(json).not.toHaveBeenCalled();
  });
});
