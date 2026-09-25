import { afterEach, describe, expect, it, vi } from "vitest";
import { setVisibleTimeout, type VisibilitySource } from "./visibility-timeout";

class FakeVisibility implements VisibilitySource {
  visibilityState: DocumentVisibilityState = "visible";
  private listeners = new Set<() => void>();
  addEventListener(_type: "visibilitychange", listener: () => void) { this.listeners.add(listener); }
  removeEventListener(_type: "visibilitychange", listener: () => void) { this.listeners.delete(listener); }
  set(value: DocumentVisibilityState) { this.visibilityState = value; for (const listener of this.listeners) listener(); }
}

afterEach(() => vi.useRealTimers());

describe("setVisibleTimeout", () => {
  it("does not count time while the page is hidden", () => {
    vi.useFakeTimers();
    const page = new FakeVisibility();
    const callback = vi.fn();
    setVisibleTimeout(callback, 15_000, page);
    vi.advanceTimersByTime(10_000);
    page.set("hidden");
    vi.advanceTimersByTime(60_000);
    expect(callback).not.toHaveBeenCalled();
    page.set("visible");
    vi.advanceTimersByTime(4_999);
    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledOnce();
  });

  it("can be cancelled while hidden", () => {
    vi.useFakeTimers();
    const page = new FakeVisibility();
    const callback = vi.fn();
    page.set("hidden");
    const cancel = setVisibleTimeout(callback, 15_000, page);
    cancel();
    page.set("visible");
    vi.advanceTimersByTime(20_000);
    expect(callback).not.toHaveBeenCalled();
  });
});
