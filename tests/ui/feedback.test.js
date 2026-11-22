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

  it('mostra a contagem e começa em "Mover para…"', () => {
    const bar = renderBulkBar(categories, 3, { moveSelected: vi.fn(), clearSelection: vi.fn() });
    expect(bar.textContent).toContain('3 canais selecionados');
    expect(bar.querySelector('select').value).toBe('');
  });

  it.each([
    ['tech', 'tech'],
    [MOVE_TO_NONE, null],
  ])('ao escolher %s move para %s', (value, expected) => {
    const actions = { moveSelected: vi.fn(), clearSelection: vi.fn() };
    const select = renderBulkBar(categories, 1, actions).querySelector('select');
    select.value = value;
    select.dispatchEvent(new Event('change'));
    expect(actions.moveSelected).toHaveBeenCalledWith(expected);
  });
});

describe('renderEmptyState', () => {
  it('mostra título, texto e a ação sugerida', () => {
    const onClick = vi.fn();
    const node = renderEmptyState({ title: 'Vazio', text: 'Faça algo', action: { label: 'Fazer', onClick } });
    node.querySelector('button').click();
    expect(node.textContent).toContain('Vazio');
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('não mostra botão sem ação', () => {
    expect(renderEmptyState({ title: 'T', text: 'x' }).querySelector('button')).toBeNull();
  });
});

describe('showToast', () => {
  it('mostra uma mensagem por vez e some depois do tempo', () => {
    vi.useFakeTimers();
    showToast('primeira');
    showToast('segunda', { duration: 1000 });
    expect(document.querySelectorAll(`#${TOAST_ID}`)).toHaveLength(1);
    expect(document.getElementById(TOAST_ID).textContent).toBe('segunda');
    vi.advanceTimersByTime(1000);
    expect(document.getElementById(TOAST_ID)).toBeNull();
  });

  it('mostra uma ação que executa e fecha o aviso', () => {
    const onClick = vi.fn();
    const toast = showToast('Feito', { action: { label: 'Desfazer', onClick } });
    toast.querySelector('button').click();
    expect(onClick).toHaveBeenCalledOnce();
    expect(document.getElementById(TOAST_ID)).toBeNull();
  });
});
