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
  it('requests during a sync get the same promise (a single run)', async () => {
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

  it('after a success, ignores new requests until the end of the interval', async () => {
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

  it("failures don't start the interval: retrying right away works", async () => {
    const run = vi.fn().mockRejectedValueOnce(new Error('rede')).mockResolvedValueOnce('ok');
    const coordinator = createSyncCoordinator(run, { now: () => 1_000 });
    await expect(coordinator.sync()).rejects.toThrow('rede');
    expect(coordinator.availableAt()).toBe(0);
    await expect(coordinator.sync()).resolves.toBe('ok');
  });

  it("an automatic refresh shares a running sync and doesn't start the cooldown", async () => {
    const pending = deferred();
    const run = vi.fn(() => pending.promise);
    const refresh = vi.fn(async () => 'refreshed');
    const coordinator = createSyncCoordinator(run, { refresh, now: () => 1_000 });
    const syncing = coordinator.sync();
    expect(coordinator.refresh()).toBe(syncing);
    pending.resolve('ok');
    await syncing;
    expect(refresh).not.toHaveBeenCalled();

    const fresh = createSyncCoordinator(run, { refresh, now: () => 1_000 });
    await fresh.refresh();
    expect(fresh.availableAt()).toBe(0);
  });

  it('a Sync click during an automatic refresh runs the full sync right after it', async () => {
    const pending = deferred();
    const run = vi.fn(async () => 'full');
    const coordinator = createSyncCoordinator(run, { refresh: () => pending.promise, now: () => 1_000 });
    coordinator.refresh();
    const clicked = coordinator.sync();
    expect(run).not.toHaveBeenCalled();
    pending.resolve();
    await expect(clicked).resolves.toBe('full');
    expect(run).toHaveBeenCalledOnce();
  });

  it('the default interval is 1 minute', () => {
    expect(SYNC_COOLDOWN_MS).toBe(60_000);
  });
});
