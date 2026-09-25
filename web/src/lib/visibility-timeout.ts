export type VisibilitySource = {
  visibilityState: DocumentVisibilityState;
  addEventListener(type: "visibilitychange", listener: () => void): void;
  removeEventListener(type: "visibilitychange", listener: () => void): void;
};

/** Runs a timeout after the requested amount of foreground-visible time. */
export function setVisibleTimeout(
  callback: () => void,
  delayMs: number,
  visibility: VisibilitySource = document,
): () => void {
  let remaining = delayMs;
  let startedAt = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let cancelled = false;

  const cleanup = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    visibility.removeEventListener("visibilitychange", onVisibilityChange);
  };

  const fire = () => {
    if (cancelled) return;
    cleanup();
    callback();
  };

  const start = () => {
    if (cancelled || timer || visibility.visibilityState !== "visible") return;
    startedAt = Date.now();
    timer = setTimeout(fire, Math.max(0, remaining));
  };

  const pause = () => {
    if (!timer) return;
    remaining = Math.max(0, remaining - (Date.now() - startedAt));
    clearTimeout(timer);
    timer = null;
  };

  function onVisibilityChange() {
    if (visibility.visibilityState === "visible") start();
    else pause();
  }

  visibility.addEventListener("visibilitychange", onVisibilityChange);
  start();

  return () => {
    cancelled = true;
    cleanup();
  };
}
