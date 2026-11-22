import { describe, expect, it, vi } from 'vitest';
import { createSyncCoordinator, SYNC_COOLDOWN_MS } from '../../src/sync/syncCoordinator.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('createSyncCoordinator', () => {
  it('pedidos durante uma sincronização recebem a mesma promise (uma execução só)', async () => {
    const pending = deferred();
    const run = vi.fn(() => pending.promise);
    const coordinator = createSyncCoordinator(run);
    const first = coordinator.sync();
    const second = coordinator.sync();
    expect(second).toBe(first);
    expect(coordinator.isRunning()).toBe(true);
    pending.resolve(42);
    await expect(first).resolves.toBe(42);
    expect(run).toHaveBeenCalledOnce();
    expect(coordinator.isRunning()).toBe(false);
  });

  it('depois de um sucesso, ignora novos pedidos até o fim do intervalo', async () => {
    let now = 1_000;
    const run = vi.fn(async () => 'ok');
    const coordinator = createSyncCoordinator(run, { now: () => now });
    await coordinator.sync();
    expect(coordinator.availableAt()).toBe(1_000 + SYNC_COOLDOWN_MS);

    now += SYNC_COOLDOWN_MS - 1;
    await expect(coordinator.sync()).resolves.toBeNull();
    expect(run).toHaveBeenCalledOnce();

    now += 1;
    await coordinator.sync();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('falhas não iniciam o intervalo: dá para tentar de novo na hora', async () => {
    const run = vi.fn().mockRejectedValueOnce(new Error('rede')).mockResolvedValueOnce('ok');
    const coordinator = createSyncCoordinator(run, { now: () => 1_000 });
    await expect(coordinator.sync()).rejects.toThrow('rede');
    expect(coordinator.availableAt()).toBe(0);
    await expect(coordinator.sync()).resolves.toBe('ok');
  });

  it('o intervalo padrão é de 1 minuto', () => {
    expect(SYNC_COOLDOWN_MS).toBe(60_000);
  });
});
