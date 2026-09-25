import { describe, expect, it, vi } from "vitest";
import { attachWhenStyleReady } from "./map-style-ready";

describe("attachWhenStyleReady", () => {
  it("attaches immediately and subscribes for future style reloads", () => {
    const setup = vi.fn();
    const on = vi.fn();
    attachWhenStyleReady({ on }, setup);
    expect(setup).toHaveBeenCalledOnce();
    expect(on).toHaveBeenCalledWith("style.load", setup);
  });

  it("keeps the style-load retry when immediate setup is too early", () => {
    const setup = vi.fn().mockImplementationOnce(() => { throw new Error("style not ready"); });
    let retry: (() => void) | undefined;
    attachWhenStyleReady({ on: (_event, callback) => { retry = callback; } }, setup);
    expect(() => retry?.()).not.toThrow();
    expect(setup).toHaveBeenCalledTimes(2);
  });
});
