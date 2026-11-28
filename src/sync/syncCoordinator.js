// Each full sync makes dozens of authenticated requests to YouTube. The coordinator lives in the
// content script's scope (one per tab) and guarantees two things:
// - one sync at a time: whoever asks while one is running gets the same promise, instead of
//   starting another in parallel;
// - a minimum interval after a successful sync, so repeated clicks don't turn into request bursts
//   (rate-limit risk).
// Failures don't start the interval: retrying right away is what's expected.
//
// The automatic refresh goes through the same gate (never in parallel with a sync) but has no
// cooldown of its own: its pace is decided by the timestamps in storage, shared by every tab.
export const SYNC_COOLDOWN_MS = 60_000;

export function createSyncCoordinator(run, { refresh = async () => null, now = Date.now, cooldownMs = SYNC_COOLDOWN_MS } = {}) {
  let inflight = null;
  let inflightKind = null;
  let lastSuccessAt = null;
  const availableAt = () => (lastSuccessAt == null ? 0 : lastSuccessAt + cooldownMs);

  function start(kind, task) {
    inflightKind = kind;
    inflight = task().finally(() => {
      inflight = null;
      inflightKind = null;
    });
    return inflight;
  }

  function sync() {
    // A click during an automatic refresh still wants the full sync: it runs right after.
    if (inflightKind === 'refresh') return inflight.catch(() => null).then(sync);
    if (inflight) return inflight;
    if (now() < availableAt()) return Promise.resolve(null);
    return start('sync', () => run().then((result) => {
      lastSuccessAt = now();
      return result;
    }));
  }

  return { sync, refresh: () => inflight ?? start('refresh', refresh), isRunning: () => inflight !== null, availableAt };
}
