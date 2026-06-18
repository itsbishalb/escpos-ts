/**
 * @module escpos-ts/interfaces/IPrinterConnection
 *
 * Hardware-agnostic connection interface that all printer transport
 * implementations must satisfy.  Designed for dependency injection and
 * testing: any object that fulfils this shape can drive the ESC/POS stack.
 */

import type { DeviceNotFoundError } from '../errors';

/**
 * Hardware-agnostic contract for a printer transport layer.
 *
 * All concrete printer classes ({@link Network}, {@link Usb}) implement this
 * interface so that higher-level code can treat any transport uniformly.
 * Pass an `IPrinterConnection` to a dependency-injection boundary or a test
 * double to decouple printing logic from hardware.
 *
 * @example
 * ```ts
 * import type { IPrinterConnection } from 'escpos-ts';
 *
 * function printReceipt(conn: IPrinterConnection, lines: string[]): Promise<void> {
 *   await conn.open();
 *   for (const line of lines) await conn.write(Buffer.from(line + '\n'));
 *   await conn.close();
 * }
 * ```
 *
 * @since 1.0.0
 */
export interface IPrinterConnection {
  /**
   * Establish a connection to the printer.
   *
   * @returns Promise that resolves when the connection is ready to accept data.
   * @throws {@link DeviceNotFoundError} if the device cannot be reached or
   *   the connection times out.
   */
  open(): Promise<void>;

  /**
   * Gracefully close the connection and release all OS/hardware resources.
   *
   * Safe to call even if the connection was never opened (no-op in that case).
   *
   * @returns Promise that resolves when the connection is fully closed.
   */
  close(): Promise<void>;

  /**
   * Write raw bytes to the printer.
   *
   * The returned promise resolves when the write has been accepted by the
   * underlying transport layer — not necessarily when the printer has
   * physically processed the data.
   *
   * @param data - Buffer containing the raw bytes to transmit.
   * @returns Promise that resolves on successful acceptance by the transport.
   * @throws {@link DeviceNotFoundError} if the connection is not open.
   */
  write(data: Buffer): Promise<void>;

  /**
   * Read bytes from the printer.
   *
   * Used to retrieve status bytes or responses to ESC/POS real-time status
   * commands (`DLE EOT`).
   *
   * @param length - Maximum number of bytes to read.  If omitted, returns
   *   the first full data chunk received.
   * @returns Promise resolving with a Buffer containing received data.
   * @throws {@link DeviceNotFoundError} if the connection is not open.
   */
  read(length?: number): Promise<Buffer>;
}
