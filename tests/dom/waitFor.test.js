import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '../../src/dom/waitFor.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  vi.useRealTimers();
});

describe('waitFor', () => {
  it('resolves right away if the element already exists', async () => {
    document.body.innerHTML = '<div id="alvo"></div>';
    await expect(waitFor('#alvo')).resolves.toBe(document.getElementById('alvo'));
  });

  it('resolves when the element appears later', async () => {
    const promise = waitFor('#tarde');
    const element = Object.assign(document.createElement('div'), { id: 'tarde' });
    document.body.append(element);
    await expect(promise).resolves.toBe(element);
  });

  it('with a null timeout keeps waiting indefinitely', async () => {
    vi.useFakeTimers();
    const promise = waitFor('#depois', { timeout: null });
    vi.advanceTimersByTime(60 * 60 * 1000);
    const element = Object.assign(document.createElement('div'), { id: 'depois' });
    document.body.append(element);
    vi.useRealTimers();
    await expect(promise).resolves.toBe(element);
  });

  it('rejects after the timeout', async () => {
    vi.useFakeTimers();
    const promise = waitFor('#nunca', { timeout: 100 });
    vi.advanceTimersByTime(100);
    await expect(promise).rejects.toThrow('#nunca');
  });
});
