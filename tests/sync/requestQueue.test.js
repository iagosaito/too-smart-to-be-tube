import { describe, expect, it, vi } from 'vitest';
import { LocalizedError } from '../../src/i18n/errors.js';
import { backoffDelay, createRequestQueue } from '../../src/sync/requestQueue.js';

// Simulated clock and wait: the test controls time without really waiting.
function fakeClock() {
  const clock = { now: 0, sleeps: [] };
  clock.sleep = vi.fn(async (ms) => {
    clock.sleeps.push(ms);
    clock.now += ms;
  });
  return clock;
}

const httpError = (status) => new LocalizedError('error.http', { status });

// Limits kept in a shared storage, like chrome.storage.local across tabs.
function sharedBudget() {
  const storage = {};
  return { load: async () => structuredClone(storage.budget ?? null), save: async (budget) => { storage.budget = structuredClone(budget); } };
}

// Regression (#3): the queue was per tab and in memory only. With N YouTube tabs the limit became N
// × 60 requests per 10 min, a 429 in one tab didn't pause the others and reloading the page (F5)
// reset the pause.
describe('limites compartilhados entre abas', () => {
  const queueFor = (clock, shared, options = {}) => createRequestQueue({ minIntervalMs: 0, now: () => clock.now, sleep: clock.sleep, shared, ...options });

  it('um 429 numa aba pausa as outras', async () => {
    const clock = fakeClock();
    const shared = sharedBudget();
    const tabA = queueFor(clock, shared);
    const tabB = queueFor(clock, shared);
    await expect(tabA.run(async () => { throw httpError(429); })).rejects.toMatchObject({ key: 'error.rateLimited' });
    const task = vi.fn(async () => 'ok');
    await expect(tabB.run(task)).rejects.toMatchObject({ key: 'error.rateLimited' });
    expect(task).not.toHaveBeenCalled();
  });

  it('recarregar a página (fila nova) não zera a pausa', async () => {
    const clock = fakeClock();
    const shared = sharedBudget();
    await expect(queueFor(clock, shared).run(async () => { throw httpError(429); })).rejects.toBeDefined();
    const task = vi.fn(async () => 'ok');
    await expect(queueFor(clock, shared).run(task)).rejects.toMatchObject({ key: 'error.rateLimited' });
    expect(task).not.toHaveBeenCalled();
  });

  it('o teto por janela soma as requisições de todas as abas', async () => {
    const clock = fakeClock();
    const shared = sharedBudget();
    const tabA = queueFor(clock, shared, { maxPerWindow: 3 });
    const tabB = queueFor(clock, shared, { maxPerWindow: 3 });
    await tabA.run(async () => 1);
    await tabA.run(async () => 2);
    await tabB.run(async () => 3);
    await expect(tabB.run(async () => 4)).rejects.toMatchObject({ key: 'error.rateLimited' });
  });
});

describe('createRequestQueue', () => {
  it('roda no máximo N tarefas ao mesmo tempo', async () => {
    const clock = fakeClock();
    const queue = createRequestQueue({ concurrency: 2, minIntervalMs: 0, now: () => clock.now, sleep: clock.sleep });
    let running = 0;
    let peak = 0;
    const task = async () => {
      running += 1;
      peak = Math.max(peak, running);
      await Promise.resolve();
      running -= 1;
    };
    await Promise.all(Array.from({ length: 6 }, () => queue.run(task)));
    expect(peak).toBe(2);
  });

  it('espaça o início das tarefas pelo intervalo mínimo', async () => {
    const clock = fakeClock();
    const starts = [];
    const queue = createRequestQueue({ concurrency: 1, minIntervalMs: 350, now: () => clock.now, sleep: clock.sleep });
    await Promise.all([1, 2, 3].map(() => queue.run(async () => starts.push(clock.now))));
    expect(starts).toEqual([0, 350, 700]);
  });

  it('recusa novas tarefas acima do teto por janela', async () => {
    const clock = fakeClock();
    const queue = createRequestQueue({ minIntervalMs: 0, maxPerWindow: 2, windowMs: 1000, now: () => clock.now, sleep: clock.sleep });
    await queue.run(async () => 'a');
    await queue.run(async () => 'b');
    await expect(queue.run(async () => 'c')).rejects.toMatchObject({ key: 'error.rateLimited' });
    clock.now += 1000;
    await expect(queue.run(async () => 'd')).resolves.toBe('d');
  });

  it('tenta de novo erros temporários (5xx) com espera crescente e desiste depois do limite', async () => {
    const clock = fakeClock();
    const queue = createRequestQueue({ minIntervalMs: 0, retries: 2, now: () => clock.now, sleep: clock.sleep, random: () => 0 });
    const flaky = vi.fn().mockRejectedValueOnce(httpError(503)).mockRejectedValueOnce(httpError(500)).mockResolvedValue('ok');
    await expect(queue.run(flaky)).resolves.toBe('ok');
    expect(clock.sleeps).toEqual([1000, 2000]);

    const broken = vi.fn().mockRejectedValue(httpError(502));
    await expect(queue.run(broken)).rejects.toMatchObject({ params: { status: 502 } });
    expect(broken).toHaveBeenCalledTimes(3);
  });

  it('não tenta de novo erros definitivos (4xx)', async () => {
    const clock = fakeClock();
    const queue = createRequestQueue({ minIntervalMs: 0, now: () => clock.now, sleep: clock.sleep });
    const notFound = vi.fn().mockRejectedValue(httpError(404));
    await expect(queue.run(notFound)).rejects.toMatchObject({ params: { status: 404 } });
    expect(notFound).toHaveBeenCalledOnce();
  });

  it('um 429 pausa a fila inteira até o fim do intervalo', async () => {
    const clock = fakeClock();
    const queue = createRequestQueue({ minIntervalMs: 0, pauseOn429Ms: 60_000, now: () => clock.now, sleep: clock.sleep });
    await expect(queue.run(async () => { throw httpError(429); })).rejects.toMatchObject({ key: 'error.rateLimited' });
    expect(queue.pausedUntil()).toBe(60_000);
    const task = vi.fn(async () => 'x');
    await expect(queue.run(task)).rejects.toMatchObject({ key: 'error.rateLimited' });
    expect(task).not.toHaveBeenCalled();
    clock.now = 60_000;
    await expect(queue.run(task)).resolves.toBe('x');
  });
});

describe('backoffDelay', () => {
  it('cresce exponencialmente, soma o jitter e respeita o teto de 8 s', () => {
    expect([0, 1, 2].map((retry) => backoffDelay(retry, () => 0))).toEqual([1000, 2000, 4000]);
    expect(backoffDelay(1, () => 0.5)).toBe(2500);
    expect(backoffDelay(5, () => 0.9)).toBe(8000);
  });
});
