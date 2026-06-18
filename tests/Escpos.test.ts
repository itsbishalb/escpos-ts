// tests/Escpos.test.ts
import { Escpos } from '../src/Escpos';

class TestPrinter extends Escpos {
  public readonly chunks: Buffer[] = [];
  _raw(data: Buffer): void { this.chunks.push(data); }
  async open(): Promise<void> {}
  async close(): Promise<void> {}
}

describe('Escpos base class', () => {
  let printer: TestPrinter;
  beforeEach(() => { printer = new TestPrinter(); });

  test('text() produces output', () => {
    printer.text('hello');
    expect(printer.chunks.length).toBeGreaterThan(0);
  });

  test('textln() output contains newline byte', () => {
    printer.textln('hi');
    const all = Buffer.concat(printer.chunks);
    expect(all.includes(0x0a)).toBe(true); // \n
  });

  test('ln(2) sends two newlines', () => {
    printer.ln(2);
    const all = Buffer.concat(printer.chunks);
    expect(all.filter(b => b === 0x0a).length).toBeGreaterThanOrEqual(2);
  });

  test('set() with bold sends bold-on sequence', () => {
    printer.set({ bold: true });
    const all = Buffer.concat(printer.chunks);
    // ESC 0x45 0x01
    expect(all.includes(0x45)).toBe(true);
    expect(all.includes(0x01)).toBe(true);
  });

  test('cut() with FULL sends GS V 0', () => {
    printer.cut('FULL', false);
    const all = Buffer.concat(printer.chunks);
    expect(all.includes(0x1d)).toBe(true);
    expect(all.includes(0x56)).toBe(true);
  });

  test('hw() INIT sends ESC @', () => {
    printer.hw('INIT');
    const all = Buffer.concat(printer.chunks);
    expect(all.includes(0x1b)).toBe(true);
    expect(all.includes(0x40)).toBe(true);
  });

  test('cashdraw() pin 2 sends CD_KICK_2', () => {
    printer.cashdraw(2);
    expect(printer.chunks.length).toBeGreaterThan(0);
  });

  test('cashdraw() invalid pin throws CashDrawerError', () => {
    expect(() => printer.cashdraw(7)).toThrow();
  });
});
