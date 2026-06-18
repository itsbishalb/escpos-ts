import { Escpos } from '../Escpos';

/**
 * Dummy printer implementation for testing and validation.
 * Accumulates all output bytes in an in-memory buffer.
 * Useful for testing print logic without physical hardware.
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
   * Get all accumulated output as a single buffer.
   * @returns Buffer containing concatenation of all captured bytes
   */
  get output(): Buffer {
    return Buffer.concat(this.chunks);
  }

  /**
   * Clear the internal buffer, resetting output to empty.
   */
  clear(): void {
    this.chunks.length = 0;
  }

  /**
   * Open (no-op for dummy printer).
   * @returns Resolved promise
   */
  async open(): Promise<void> {}

  /**
   * Close (no-op for dummy printer).
   * @returns Resolved promise
   */
  async close(): Promise<void> {}
}
