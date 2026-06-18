/**
 * @module escpos-ts/printers/Network
 *
 * TCP/IP printer implementation for ESC/POS printers accessible over a network.
 * Uses Node.js `net.Socket` for transport.  Nagle's algorithm is disabled on
 * the socket so each `_raw()` call is transmitted as an individual TCP packet
 * without buffering delay.
 */

// src/printers/Network.ts
import * as net from 'net';
import { Escpos } from '../Escpos';
import { DeviceNotFoundError } from '../errors';

/**
 * Configuration options for the {@link Network} printer.
 *
 * @since 1.0.0
 */
export interface NetworkConfig {
  /** IP address or hostname of the printer */
  host: string;
  /** TCP port to connect to (default: 9100) */
  port?: number;
  /** Connection timeout in milliseconds (default: 5000) */
  timeout?: number;
  /** Printer profile name to use (default: 'default') */
  profileName?: string;
}

/**
 * Network (TCP/IP) printer implementation.
 *
 * Connects to an ESC/POS printer over a TCP socket using Node.js `net.Socket`.
 *
 * @example
 * ```ts
 * const printer = new Network({ host: '192.168.1.100', port: 9100 });
 * await printer.open();
 * printer.textln('Hello, World!');
 * printer.cut();
 * await printer.close();
 * ```
 *
 * @since 1.0.0
 */
export class Network extends Escpos {
  private readonly host: string;
  private readonly port: number;
  private readonly timeout: number;
  private socket: net.Socket | null = null;
  /** Last error emitted by the socket after connect, stored for _raw() diagnostics */
  private lastSocketError: Error | null = null;

  /**
   * Create a new Network printer instance.
   *
   * @param config - Network configuration options
   * @param config.host - IP address or hostname of the printer
   * @param config.port - TCP port (default: 9100)
   * @param config.timeout - Connection timeout in ms (default: 5000)
   * @param config.profileName - Printer profile name (default: 'default')
   */
  constructor({ host, port = 9100, timeout = 5000, profileName }: NetworkConfig) {
    super(profileName);
    this.host = host;
    this.port = port;
    this.timeout = timeout;
  }

  /**
   * Open a TCP connection to the printer.
   *
   * Resolves when the socket successfully connects.
   * Rejects with {@link DeviceNotFoundError} if connection fails or times out.
   *
   * @returns Promise that resolves when connected
   * @throws {DeviceNotFoundError} if connection fails or timeout expires
   * @since 1.0.0
   */
  async open(): Promise<void> {
    if (this.socket) {
      await this.close();
    }

    return new Promise<void>((resolve, reject) => {
      const s = new net.Socket();

      const timeoutHandle = setTimeout(() => {
        s.destroy();
        reject(new DeviceNotFoundError(`Connection to ${this.host}:${this.port} timed out after ${this.timeout}ms`));
      }, this.timeout);

      s.connect(this.port, this.host, () => {
        clearTimeout(timeoutHandle);

        // Disable Nagle's algorithm so each _raw() write is sent as an
        // individual TCP packet immediately rather than being coalesced.
        // Without this, small ESC/POS commands sit in the OS buffer
        // indefinitely while the connection stays open.
        s.setNoDelay(true);

        this.socket = s;
        this.lastSocketError = null;

        // Keep a persistent error handler so Node.js doesn't crash on
        // post-connect socket errors (e.g. printer resets mid-print).
        s.on('error', (err: Error) => {
          this.lastSocketError = err;
          this.socket = null;
          s.destroy();
        });

        resolve();
      });

      // Pre-connect error (host unreachable, refused, etc.)
      s.once('error', (err: Error) => {
        clearTimeout(timeoutHandle);
        s.destroy();
        reject(new DeviceNotFoundError(err.message));
      });
    });
  }

  /**
   * Write raw bytes directly to the TCP socket.
   *
   * This is the low-level method called by all higher-level Escpos methods.
   *
   * @param data - Buffer containing ESC/POS command bytes to send
   * @throws {DeviceNotFoundError} if socket is not open
   * @since 1.0.0
   */
  _raw(data: Buffer): void {
    if (!this.socket) {
      const reason = this.lastSocketError
        ? this.lastSocketError.message
        : 'Call open() first.';
      throw new DeviceNotFoundError(`Network socket is not open. ${reason}`);
    }
    // Swallow write-callback errors — the persistent 'error' handler above
    // will fire first and null out this.socket, giving a clear error on the
    // next _raw() call rather than crashing the process.
    this.socket.write(data);
  }

  /**
   * Read data from the printer.
   *
   * Resolves with up to `length` bytes received from the `'data'` event.
   * If `length` is not specified, returns the full first data chunk received.
   *
   * @param length - Maximum number of bytes to read (optional)
   * @returns Promise resolving with a Buffer containing received data
   * @throws {DeviceNotFoundError} if socket is not open
   * @since 1.0.0
   */
  read(length?: number): Promise<Buffer> {
    if (!this.socket) {
      return Promise.reject(new DeviceNotFoundError('Network socket is not open. Call open() first.'));
    }

    return new Promise<Buffer>((resolve) => {
      this.socket!.once('data', (chunk: Buffer) => {
        resolve(length !== undefined ? chunk.subarray(0, length) : chunk);
      });
    });
  }

  /**
   * Wait for all buffered writes to be flushed to the OS TCP stack.
   *
   * Call this after the last `_raw()` write in a print job to guarantee all
   * data reaches the printer before `close()` destroys the socket.
   *
   * @returns Promise that resolves when the socket `'drain'` event fires, or
   *   immediately if there is nothing to drain.
   * @since 1.0.0
   */
  flush(): Promise<void> {
    if (!this.socket) return Promise.resolve();
    if (!this.socket.writableNeedDrain) return Promise.resolve();
    return new Promise<void>((resolve) => {
      this.socket!.once('drain', resolve);
    });
  }

  /**
   * Close the TCP connection.
   *
   * Destroys the socket and cleans up the reference.
   * Safe to call even if already closed (no-op).
   *
   * @returns Promise that resolves when the socket is destroyed
   * @since 1.0.0
   */
  async close(): Promise<void> {
    if (!this.socket) {
      return;
    }
    this.socket.destroy();
    this.socket = null;
  }
}
