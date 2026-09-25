import { describe, expect, it, vi } from "vitest";
import { configureMaplibreWorker, MAPLIBRE_WORKER_URL } from "./maplibre-worker";

describe("MapLibre worker configuration", () => {
  it("uses the self-hosted module worker path", () => {
    expect(MAPLIBRE_WORKER_URL).toBe("/maplibre/maplibre-gl-worker.mjs");
  });

  it("configures the worker only once", () => {
    const setter = vi.fn();
    configureMaplibreWorker(setter);
    configureMaplibreWorker(setter);
    expect(setter).toHaveBeenCalledOnce();
    expect(setter).toHaveBeenCalledWith(MAPLIBRE_WORKER_URL);
  });
});
