import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadTextFile } from '../../src/ui/download.js';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('downloadTextFile', () => {
  it('clica num link temporário com o nome do arquivo e revoga a URL depois', () => {
    vi.useFakeTimers();
    // jsdom não implementa createObjectURL/revokeObjectURL.
    URL.createObjectURL = vi.fn(() => 'blob:fake');
    URL.revokeObjectURL = vi.fn();
    const clicks = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click() {
      clicks.push({ href: this.getAttribute('href'), download: this.getAttribute('download') });
    });

    downloadTextFile('arquivo.csv', 'a,b');

    expect(clicks).toEqual([{ href: 'blob:fake', download: 'arquivo.csv' }]);
    expect(document.querySelector('a[download]')).toBeNull();
    const blob = URL.createObjectURL.mock.calls[0][0];
    expect(blob.type).toBe('text/csv;charset=utf-8');
    expect(blob.size).toBe('a,b'.length);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake');
  });
});
