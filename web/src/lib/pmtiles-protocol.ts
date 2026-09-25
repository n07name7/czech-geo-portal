import { Protocol } from "pmtiles";
import type { addProtocol } from "maplibre-gl";

const protocols = new WeakMap<typeof addProtocol, Protocol>();

/** MapLibre's protocol registry is global, not owned by individual maps.
 * Keep it registered for the application lifetime: unmounting one map must
 * never break another map (including React StrictMode remounts).
 */
export function ensurePmtilesProtocol(register: typeof addProtocol): Protocol {
  let protocol = protocols.get(register);
  if (!protocol) {
    protocol = new Protocol();
    register("pmtiles", protocol.tile);
    protocols.set(register, protocol);
  }
  return protocol;
}
