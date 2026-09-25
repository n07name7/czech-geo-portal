export const MAPLIBRE_WORKER_URL = "/maplibre/maplibre-gl-worker.mjs";

let configured = false;

export function configureMaplibreWorker(setWorkerUrl: (url: string) => void): void {
  if (configured) return;
  setWorkerUrl(MAPLIBRE_WORKER_URL);
  configured = true;
}
