/**
 * @module escpos-ts/printers/Dummy
 *
 * In-memory printer implementation for testing and validation.
 * Accumulates all ESC/POS output bytes in a buffer instead of sending
 * them to hardware.  Ideal for unit tests and print-payload inspection.
 */

import { Escpos } from '../Escpos';

/**
 * In-memory ESC/POS printer for testing and validation.
 *
 * All bytes written via `_raw()` are appended to an internal buffer.
 * Retrieve the accumulated output with the {@link output} getter or clear it
 * with {@link clear}.
 *
 * `open()` and `close()` are no-ops — the class is always "connected".
 *
 * @example
 * ```ts
 * import { Dummy } from 'escpos-ts';
 *
 * const printer = new Dummy('TM-T88V');
 * printer.setWithDefault({ bold: true, align: 'center' });
 * printer.textln('Hello');
 * printer.cut();
 *
 * const bytes = printer.output;
 * // bytes is a Buffer containing the complete ESC/POS byte stream
 * ```
 *
 * @since 1.0.0
 */
export class Dummy extends Escpos {
  /** Internal buffer storing all written chunks */
  private readonly chunks: Buffer[] = [];

  /**
   * Capture raw data into the internal buffer.
   * @param data - Buffer containing the bytes to capture
   */
  _raw(data: Buffer): void {
    this.chunks.push(data);
  }

  /**
   * Get all accumulated output as a single concatenated buffer.
   *
   * @returns `Buffer` containing all bytes written since construction or the
   *   last {@link clear} call.
   * @since 1.0.0
   */
  get output(): Buffer {
    return Buffer.concat(this.chunks);
  }

  /**
   * Clear the internal buffer, resetting accumulated output to empty.
   *
   * @since 1.0.0
   */
  clear(): void {
    this.chunks.length = 0;
  }

  /**
   * Open (no-op for dummy printer).
   * @returns Resolved promise
   * @since 1.0.0
   */
  async open(): Promise<void> {}

  /**
   * Close (no-op for dummy printer).
   * @returns Resolved promise
   * @since 1.0.0
   */
  async close(): Promise<void> {}
}
