import { LocalizedError } from '../i18n/errors.js';

// Fila única (por aba) para as consultas aos canais do feed por categoria.
// Mesmo sendo requisições públicas, sem cookies, rajadas podem levar o
// YouTube a limitar o IP; a fila mantém o ritmo parecido com o de uma pessoa
// navegando e para tudo se o YouTube pedir (429).
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
    ...options,
  };
  const state = { active: 0, waiting: [], starts: [], nextStart: 0, pausedUntil: 0 };
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
        throw rateLimited();
      }
      if (!isTransient(status) || retry >= config.retries) throw error;
      await config.sleep(backoffDelay(retry, config.random));
    }
  }
}

async function reserveSlot(state, config) {
  const now = config.now();
  if (now < state.pausedUntil) throw rateLimited();
  state.starts = state.starts.filter((startedAt) => now - startedAt < config.windowMs);
  if (state.starts.length >= config.maxPerWindow) throw rateLimited();
  // A vaga é reservada antes de esperar: duas tarefas simultâneas nunca
  // pegam o mesmo horário de início.
  const startAt = Math.max(now, state.nextStart);
  state.nextStart = startAt + config.minIntervalMs;
  state.starts.push(startAt);
  if (startAt > now) await config.sleep(startAt - now);
}

function isTransient(status) {
  return status === 408 || (status >= 500 && status < 600);
}

// Espera exponencial truncada com jitter (recomendação do Google Cloud): o
// acaso evita que várias abas tentem de novo exatamente juntas.
export function backoffDelay(retry, random = Math.random) {
  return Math.min(2 ** retry * 1000 + random() * 1000, 8000);
}

function rateLimited() {
  return new LocalizedError('error.rateLimited');
}
