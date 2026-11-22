import { describe, expect, it, vi } from 'vitest';
import { isContextInvalidated, isExtensionAlive, runIfAlive } from '../../src/content/extensionContext.js';

const alive = { runtime: { id: 'abc' } };
const orphaned = { runtime: {} };

describe('isExtensionAlive', () => {
  it('fica falso quando runtime.id some ou o acesso lança', () => {
    expect(isExtensionAlive(alive)).toBe(true);
    expect(isExtensionAlive(orphaned)).toBe(false);
    expect(isExtensionAlive(undefined)).toBe(false);
    const throwing = { get runtime() { throw new Error('Extension context invalidated.'); } };
    expect(isExtensionAlive(throwing)).toBe(false);
  });
});

describe('isContextInvalidated', () => {
  it('reconhece o erro do Chrome e ignora outros', () => {
    expect(isContextInvalidated(new Error('Extension context invalidated.'))).toBe(true);
    expect(isContextInvalidated(new Error('Network error'))).toBe(false);
  });
});

describe('runIfAlive', () => {
  it('executa a tarefa quando a extensão está viva', async () => {
    await expect(runIfAlive(async () => 42, vi.fn(), alive)).resolves.toBe(42);
  });

  it('não executa e chama onOrphaned quando o contexto já foi perdido', async () => {
    const task = vi.fn();
    const onOrphaned = vi.fn(() => 'órfão');
    await expect(runIfAlive(task, onOrphaned, orphaned)).resolves.toBe('órfão');
    expect(task).not.toHaveBeenCalled();
  });

  it('chama onOrphaned se o contexto se perder no meio da tarefa', async () => {
    const onOrphaned = vi.fn();
    await runIfAlive(async () => {
      throw new Error('Extension context invalidated.');
    }, onOrphaned, alive);
    expect(onOrphaned).toHaveBeenCalledOnce();
  });

  it('deixa outros erros seguirem normalmente', async () => {
    await expect(runIfAlive(async () => {
      throw new Error('outro problema');
    }, vi.fn(), alive)).rejects.toThrow('outro problema');
  });
});
