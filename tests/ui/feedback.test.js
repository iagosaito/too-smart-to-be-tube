import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MOVE_TO_NONE, renderBulkBar, renderEmptyState, showToast, TOAST_ID } from '../../src/ui/components/feedback.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  vi.useRealTimers();
});

describe('renderBulkBar', () => {
  const categories = [{ id: 'tech', name: 'Tech', channelIds: [] }];

  it('shows the count and starts at "Mover para…"', () => {
    const bar = renderBulkBar(categories, 3, { moveSelected: vi.fn(), clearSelection: vi.fn() });
    expect(bar.textContent).toContain('3 canais selecionados');
    expect(bar.querySelector('select').value).toBe('');
  });

  it.each([
    ['tech', 'tech'],
    [MOVE_TO_NONE, null],
  ])('choosing %s moves to %s', (value, expected) => {
    const actions = { moveSelected: vi.fn(), clearSelection: vi.fn() };
    const select = renderBulkBar(categories, 1, actions).querySelector('select');
    select.value = value;
    select.dispatchEvent(new Event('change'));
    expect(actions.moveSelected).toHaveBeenCalledWith(expected);
  });
});

describe('renderEmptyState', () => {
  it('shows the title, the text and the suggested action', () => {
    const onClick = vi.fn();
    const node = renderEmptyState({ title: 'Vazio', text: 'Faça algo', action: { label: 'Fazer', onClick } });
    node.querySelector('button').click();
    expect(node.textContent).toContain('Vazio');
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('shows no button without an action', () => {
    expect(renderEmptyState({ title: 'T', text: 'x' }).querySelector('button')).toBeNull();
  });
});

describe('showToast', () => {
  it('shows one message at a time and disappears after the timeout', () => {
    vi.useFakeTimers();
    showToast('primeira');
    showToast('segunda', { duration: 1000 });
    expect(document.querySelectorAll(`#${TOAST_ID}`)).toHaveLength(1);
    expect(document.getElementById(TOAST_ID).textContent).toBe('segunda');
    vi.advanceTimersByTime(1000);
    expect(document.getElementById(TOAST_ID)).toBeNull();
  });

  it('shows an action that runs and closes the toast', () => {
    const onClick = vi.fn();
    const toast = showToast('Feito', { action: { label: 'Desfazer', onClick } });
    toast.querySelector('button').click();
    expect(onClick).toHaveBeenCalledOnce();
    expect(document.getElementById(TOAST_ID)).toBeNull();
  });
});
