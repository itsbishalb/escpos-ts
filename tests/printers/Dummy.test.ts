import { Dummy } from '../../src/printers/Dummy';

describe('Dummy printer', () => {
  test('output is empty on creation', () => {
    const p = new Dummy();
    expect(p.output.length).toBe(0);
  });

  test('text() accumulates bytes in output', async () => {
    const p = new Dummy();
    p.text('A');
    expect(p.output.includes(0x41)).toBe(true);
  });

  test('clear() resets output', () => {
    const p = new Dummy();
    p.text('hello');
    p.clear();
    expect(p.output.length).toBe(0);
  });

  test('open() and close() resolve without error', async () => {
    const p = new Dummy();
    await expect(p.open()).resolves.toBeUndefined();
    await expect(p.close()).resolves.toBeUndefined();
  });

  test('cut() FULL appends GS V bytes', () => {
    const p = new Dummy();
    p.cut('FULL', false);
    const bytes = p.output;
    expect(bytes.includes(0x1d)).toBe(true);
    expect(bytes.includes(0x56)).toBe(true);
  });
});
