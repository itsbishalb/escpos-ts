// src/printers/Network.ts
import * as net from 'net';
import { Escpos } from '../Escpos';
import { DeviceNotFoundError } from '../errors';

/**
 * Configuration object for the Network printer.
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
 */
export class Network extends Escpos {
  private readonly host: string;
  private readonly port: number;
  private readonly timeout: number;
  private socket: net.Socket | null = null;

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
        this.socket = s;
        resolve();
      });

      s.on('error', (err: Error) => {
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
   */
  _raw(data: Buffer): void {
    if (!this.socket) {
      throw new DeviceNotFoundError('Network socket is not open. Call open() first.');
    }
    this.socket.write(data, (err?: Error | null) => {
      if (err) {
        throw new DeviceNotFoundError(err.message);
      }
    });
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
   * Close the TCP connection.
   *
   * Destroys the socket and cleans up the reference.
   * Safe to call even if already closed (no-op).
   *
   * @returns Promise that resolves when the socket is destroyed
   */
  async close(): Promise<void> {
    if (!this.socket) {
      return;
    }
    this.socket.destroy();
    this.socket = null;
  }
}
