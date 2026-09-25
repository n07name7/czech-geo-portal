export type StyleReadyMap = {
  on(event: "style.load", callback: () => void): unknown;
};

/**
 * Installs style-dependent sources/layers without waiting for map `load`.
 * `load` also waits for external tiles and can therefore never fire when a
 * basemap provider is slow or unavailable.
 */
export function attachWhenStyleReady(map: StyleReadyMap, setup: () => void): void {
  try {
    setup();
  } catch {
    // A newly constructed MapLibre style may not be ready synchronously.
    // The style.load listener below is the authoritative retry.
  }
  map.on("style.load", setup);
}
