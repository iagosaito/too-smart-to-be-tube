import { LocalizedError } from '../i18n/errors.js';

// Fila para as consultas aos canais do feed por categoria. Mesmo sendo
// requisições públicas, sem cookies, rajadas podem levar o YouTube a limitar o
// IP (o mesmo da sessão logada); a fila mantém o ritmo parecido com o de uma
// pessoa navegando e para tudo se o YouTube pedir (429).
//
// Com `shared` (o chrome.storage), a pausa e o teto por janela valem para
// todas as abas do YouTube e sobrevivem a recarregar a página; sem ele, valem
// só para esta fila (testes).
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
  // starts: inícios dentro da janela, cada um com id próprio (duas abas podem
  // começar no mesmo milissegundo e precisam contar duas vezes).
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
  // A vaga é reservada antes de esperar: duas tarefas simultâneas nunca
  // pegam o mesmo horário de início.
  const startAt = Math.max(now, state.nextStart);
  state.nextStart = startAt + config.minIntervalMs;
  state.count += 1;
  state.starts.push({ at: startAt, id: `${state.id}:${state.count}` });
  await pushShared(state, config);
  if (startAt > now) await config.sleep(startAt - now);
}

// Junta o que as outras abas registraram: a pausa mais longa e todos os
// inícios dentro da janela. O storage não tem transações, então duas abas
// reservando no mesmo instante podem contar uma a menos; o teto continua
// valendo com essa folga mínima.
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

// Espera exponencial truncada com jitter (recomendação do Google Cloud): o
// acaso evita que várias abas tentem de novo exatamente juntas.
export function backoffDelay(retry, random = Math.random) {
  return Math.min(2 ** retry * 1000 + random() * 1000, 8000);
}

function rateLimited() {
  return new LocalizedError('error.rateLimited');
}
