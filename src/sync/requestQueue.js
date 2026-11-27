import { LocalizedError } from '../i18n/errors.js';

// Queue for the per-category feed's channel requests. Even though they are public requests without
// cookies, bursts may lead YouTube to throttle the IP (the same as the logged-in session's); the
// queue keeps a pace similar to a person browsing and stops everything if YouTube asks (429).
//
// With `shared` (chrome.storage), the pause and the per-window cap apply to every YouTube tab and
// survive a page reload; without it, they apply only to this queue (tests).
export const QUEUE_DEFAULTS = {
  concurrency: 2,
  minIntervalMs: 350,
  maxPerWindow: 60,
  windowMs: 10 * 60_000,
  pauseOn429Ms: 10 * 60_000,
  retries: 2,
};

export function createRequestQueue(options = {}) {
  const config = {
    ...QUEUE_DEFAULTS,
    now: Date.now,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    random: Math.random,
    shared: null,
    ...options,
  };
  // starts: starts within the window, each with its own id (two tabs may start in the same
  // millisecond and must count twice).
  const state = { active: 0, waiting: [], starts: [], nextStart: 0, pausedUntil: 0, id: crypto.randomUUID(), count: 0 };
  return {
    run: (task) => new Promise((resolve, reject) => {
      state.waiting.push({ task, resolve, reject });
      pump(state, config);
    }),
    pausedUntil: () => state.pausedUntil,
  };
}

function pump(state, config) {
  while (state.active < config.concurrency && state.waiting.length) {
    const job = state.waiting.shift();
    state.active += 1;
    attempt(job.task, state, config)
      .then(job.resolve, job.reject)
      .finally(() => {
        state.active -= 1;
        pump(state, config);
      });
  }
}

async function attempt(task, state, config) {
  for (let retry = 0; ; retry += 1) {
    await reserveSlot(state, config);
    try {
      return await task();
    } catch (error) {
      const status = error?.params?.status ?? error?.status;
      if (status === 429) {
        state.pausedUntil = config.now() + config.pauseOn429Ms;
        await pushShared(state, config);
        throw rateLimited();
      }
      if (!isTransient(status) || retry >= config.retries) throw error;
      await config.sleep(backoffDelay(retry, config.random));
    }
  }
}

async function reserveSlot(state, config) {
  await pullShared(state, config);
  const now = config.now();
  if (now < state.pausedUntil) throw rateLimited();
  state.starts = state.starts.filter((start) => now - start.at < config.windowMs);
  if (state.starts.length >= config.maxPerWindow) throw rateLimited();
  // The slot is reserved before waiting: two simultaneous tasks never get the same start time.
  const startAt = Math.max(now, state.nextStart);
  state.nextStart = startAt + config.minIntervalMs;
  state.count += 1;
  state.starts.push({ at: startAt, id: `${state.id}:${state.count}` });
  await pushShared(state, config);
  if (startAt > now) await config.sleep(startAt - now);
}

// Merges what the other tabs recorded: the longest pause and every start within the window. Storage
// has no transactions, so two tabs reserving at the same instant may count one fewer; the cap still
// holds with that minimal slack.
async function pullShared(state, config) {
  if (!config.shared) return;
  const budget = await config.shared.load().catch(() => null);
  if (!budget) return;
  state.pausedUntil = Math.max(state.pausedUntil, budget.pausedUntil ?? 0);
  const known = new Set(state.starts.map((start) => start.id));
  state.starts = [...state.starts, ...(budget.starts ?? []).filter((start) => start?.id && !known.has(start.id))];
}

async function pushShared(state, config) {
  if (!config.shared) return;
  const now = config.now();
  const starts = state.starts.filter((start) => now - start.at < config.windowMs);
  await config.shared.save({ pausedUntil: state.pausedUntil, starts }).catch(() => {});
}

function isTransient(status) {
  return status === 408 || (status >= 500 && status < 600);
}

// Truncated exponential backoff with jitter (Google Cloud's recommendation): the randomness keeps
// several tabs from retrying at exactly the same time.
export function backoffDelay(retry, random = Math.random) {
  return Math.min(2 ** retry * 1000 + random() * 1000, 8000);
}

function rateLimited() {
  return new LocalizedError('error.rateLimited');
}
