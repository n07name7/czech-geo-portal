import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const config = readFileSync(new URL("../../next.config.mjs", import.meta.url), "utf8");

describe("browser security headers", () => {
  it("does not expose the framework fingerprint", () => {
    expect(config).toContain("poweredByHeader: false");
  });

  it.each([
    "Content-Security-Policy",
    "X-Content-Type-Options",
    "X-Frame-Options",
    "Permissions-Policy",
    "Cross-Origin-Opener-Policy",
    "Referrer-Policy",
  ])("configures %s", (header) => expect(config).toContain(header));

  it("allows only the browser origins required by maps and geocoding", () => {
    for (const directive of ["default-src 'self'", "object-src 'none'", "frame-ancestors 'none'", "worker-src 'self' blob:"]) {
      expect(config).toContain(directive);
    }
    for (const origin of ["photon.komoot.io", "server.arcgisonline.com", "*.basemaps.cartocdn.com"]) {
      expect(config).toContain(origin);
    }
  });
});
