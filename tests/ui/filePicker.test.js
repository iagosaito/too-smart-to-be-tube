import { afterEach, describe, expect, it, vi } from 'vitest';
import { pickFile } from '../../src/ui/filePicker.js';

afterEach(() => {
  vi.restoreAllMocks();
});

// jsdom doesn't open a file picker; we capture the input created on click.
function captureInput() {
  let input;
  vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function click() {
    input = this;
  });
  return () => input;
}

describe('pickFile', () => {
  it('opens a CSV file input and resolves with the chosen file', async () => {
    const getInput = captureInput();
    const promise = pickFile();
    const input = getInput();
    expect(input.type).toBe('file');
    expect(input.accept).toBe('.csv,text/csv');
    const file = new File(['a,b'], 'x.csv');
    Object.defineProperty(input, 'files', { value: [file] });
    input.dispatchEvent(new Event('change'));
    await expect(promise).resolves.toBe(file);
    expect(input.isConnected).toBe(false);
  });

  it('resolves null and removes the input when the user cancels', async () => {
    const getInput = captureInput();
    const promise = pickFile();
    getInput().dispatchEvent(new Event('cancel'));
    await expect(promise).resolves.toBeNull();
    expect(document.querySelector('input[type=file]')).toBeNull();
  });
});
