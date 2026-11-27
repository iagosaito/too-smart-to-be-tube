// Each full sync makes dozens of authenticated requests to YouTube. The coordinator lives in the
// content script's scope (one per tab) and guarantees two things:
// - one sync at a time: whoever asks while one is running gets the same promise, instead of
//   starting another in parallel;
// - a minimum interval after a successful sync, so repeated clicks don't turn into request bursts
//   (rate-limit risk).
// Failures don't start the interval: retrying right away is what's expected.
export const SYNC_COOLDOWN_MS = 60_000;

export function createSyncCoordinator(run, { now = Date.now, cooldownMs = SYNC_COOLDOWN_MS } = {}) {
  let inflight = null;
  let lastSuccessAt = null;
  const availableAt = () => (lastSuccessAt == null ? 0 : lastSuccessAt + cooldownMs);

  function sync() {
    if (inflight) return inflight;
    if (now() < availableAt()) return Promise.resolve(null);
    inflight = run()
      .then((result) => {
        lastSuccessAt = now();
        return result;
      })
      .finally(() => {
        inflight = null;
      });
    return inflight;
  }

  return { sync, isRunning: () => inflight !== null, availableAt };
}
