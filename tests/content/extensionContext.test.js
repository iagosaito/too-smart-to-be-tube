import { describe, expect, it, vi } from 'vitest';
import { isContextInvalidated, isExtensionAlive, runIfAlive } from '../../src/content/extensionContext.js';

const alive = { runtime: { id: 'abc' } };
const orphaned = { runtime: {} };

describe('isExtensionAlive', () => {
  it('turns false when runtime.id disappears or reading it throws', () => {
    expect(isExtensionAlive(alive)).toBe(true);
    expect(isExtensionAlive(orphaned)).toBe(false);
    expect(isExtensionAlive(undefined)).toBe(false);
    const throwing = { get runtime() { throw new Error('Extension context invalidated.'); } };
    expect(isExtensionAlive(throwing)).toBe(false);
  });
});

describe('isContextInvalidated', () => {
  it("recognizes Chrome's error and ignores others", () => {
    expect(isContextInvalidated(new Error('Extension context invalidated.'))).toBe(true);
    expect(isContextInvalidated(new Error('Network error'))).toBe(false);
  });
});

describe('runIfAlive', () => {
  it('runs the task when the extension is alive', async () => {
    await expect(runIfAlive(async () => 42, vi.fn(), alive)).resolves.toBe(42);
  });

  it("doesn't run and calls onOrphaned when the context is already lost", async () => {
    const task = vi.fn();
    const onOrphaned = vi.fn(() => 'órfão');
    await expect(runIfAlive(task, onOrphaned, orphaned)).resolves.toBe('órfão');
    expect(task).not.toHaveBeenCalled();
  });

  it('calls onOrphaned if the context is lost in the middle of the task', async () => {
    const onOrphaned = vi.fn();
    await runIfAlive(async () => {
      throw new Error('Extension context invalidated.');
    }, onOrphaned, alive);
    expect(onOrphaned).toHaveBeenCalledOnce();
  });

  it('lets other errors through as usual', async () => {
    await expect(runIfAlive(async () => {
      throw new Error('outro problema');
    }, vi.fn(), alive)).rejects.toThrow('outro problema');
  });
});
