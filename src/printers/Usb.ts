// src/printers/Usb.ts
import { findByIds, getDeviceList, OutEndpoint, InEndpoint } from 'usb';
import type { Device, Interface, Endpoint } from 'usb';

// USB bulk transfer type constant (libusb value 2)
const LIBUSB_TRANSFER_TYPE_BULK = 2;
import { Escpos } from '../Escpos';
import { USBNotFoundError } from '../errors';

/**
 * Configuration object for the USB printer.
 */
export interface UsbConfig {
  /** USB Vendor ID (e.g. 0x04b8 for Epson) */
  vendorId: number;
  /** USB Product ID (e.g. 0x0202 for Epson TM-T88IV) */
  productId: number;
  /**
   * USB interface number to claim (default: 0).
   * Most ESC/POS printers expose a single printer interface at index 0.
   */
  interface?: number;
  /** Printer profile name to use (default: 'default') */
  profileName?: string;
}

/**
 * Minimal device info returned by {@link Usb.listDevices}.
 */
export interface UsbDeviceInfo {
  /** USB Vendor ID */
  vendorId: number;
  /** USB Product ID */
  productId: number;
}

/**
 * USB printer implementation.
 *
 * Communicates with an ESC/POS printer over USB using the `usb` npm package
 * (libusb bindings). Finds the device by Vendor/Product ID, claims the first
 * matching interface, and writes to the first bulk-OUT endpoint.
 *
 * @example
 * ```ts
 * const printer = new Usb({ vendorId: 0x04b8, productId: 0x0202 });
 * await printer.open();
 * printer.textln('Hello, World!');
 * printer.cut();
 * await printer.close();
 * ```
 */
export class Usb extends Escpos {
  private readonly vendorId: number;
  private readonly productId: number;
  private readonly interfaceNumber: number;

  private device: Device | null = null;
  private usbInterface: Interface | null = null;
  private outEndpoint: OutEndpoint | null = null;
  private inEndpoint: InEndpoint | null = null;

  /**
   * Create a new USB printer instance.
   *
   * @param config - USB configuration options
   * @param config.vendorId  - USB Vendor ID of the printer
   * @param config.productId - USB Product ID of the printer
   * @param config.interface - USB interface number to claim (default: 0)
   * @param config.profileName - Printer profile name (default: 'default')
   */
  constructor({
    vendorId,
    productId,
    interface: iface = 0,
    profileName,
  }: UsbConfig) {
    super(profileName);
    this.vendorId = vendorId;
    this.productId = productId;
    this.interfaceNumber = iface;
  }

  /**
   * Return a list of all USB devices currently connected to the host.
   *
   * This is a static utility method that does not require an open device.
   *
   * @returns Array of {@link UsbDeviceInfo} objects (vendorId, productId)
   */
  static listDevices(): UsbDeviceInfo[] {
    return getDeviceList().map((d) => ({
      vendorId: d.deviceDescriptor.idVendor,
      productId: d.deviceDescriptor.idProduct,
    }));
  }

  /**
   * Open the USB device, claim the interface, and locate endpoints.
   *
   * Resolves when the device is ready to receive data.
   * Rejects with {@link USBNotFoundError} if:
   * - No device matching the VID/PID is connected.
   * - No bulk-OUT endpoint exists on the specified interface.
   *
   * @returns Promise that resolves when the device is open and claimed
   * @throws {USBNotFoundError} if the device or a suitable endpoint is not found
   */
  async open(): Promise<void> {
    const dev = findByIds(this.vendorId, this.productId);
    if (!dev) {
      throw new USBNotFoundError(
        `VID=0x${this.vendorId.toString(16).padStart(4, '0')} ` +
        `PID=0x${this.productId.toString(16).padStart(4, '0')}`,
      );
    }

    dev.open();
    const iface = dev.interface(this.interfaceNumber);
    iface.claim();

    // Locate the first bulk-OUT endpoint (required for sending print data)
    const outEp = iface.endpoints.find(
      (e: Endpoint) => e.direction === 'out' && e.transferType === LIBUSB_TRANSFER_TYPE_BULK,
    ) as OutEndpoint | undefined;

    if (!outEp) {
      throw new USBNotFoundError(
        `No bulk-OUT endpoint found on interface ${this.interfaceNumber}`,
      );
    }

    // Locate the first bulk-IN endpoint if present (optional — for status reads)
    const inEp = iface.endpoints.find(
      (e: Endpoint) => e.direction === 'in' && e.transferType === LIBUSB_TRANSFER_TYPE_BULK,
    ) as InEndpoint | undefined;

    this.device = dev;
    this.usbInterface = iface;
    this.outEndpoint = outEp;
    this.inEndpoint = inEp ?? null;
  }

  /**
   * Write raw bytes to the USB bulk-OUT endpoint.
   *
   * This is the low-level method called by all higher-level Escpos methods.
   * The transfer is fire-and-forget (callback-based), matching how most POS
   * printers operate — they accept data as fast as the host can send it.
   *
   * @param data - Buffer containing ESC/POS command bytes to send
   * @throws {USBNotFoundError} if the device has not been opened
   */
  _raw(data: Buffer): void {
    if (!this.outEndpoint) {
      throw new USBNotFoundError('USB device is not open. Call open() first.');
    }
    this.outEndpoint.transfer(data, (err) => {
      if (err) {
        // Errors inside the transfer callback cannot propagate back to the
        // synchronous caller, but we surface them for observability.
        throw new USBNotFoundError(err.message);
      }
    });
  }

  /**
   * Read data from the USB bulk-IN endpoint (if present).
   *
   * Used to retrieve printer status bytes (e.g. paper-out, cover-open).
   * If no IN endpoint was found during {@link open}, rejects immediately.
   *
   * @param length - Number of bytes to request (default: 64)
   * @returns Promise resolving with a Buffer containing received data
   * @throws {USBNotFoundError} if the device is not open or has no IN endpoint
   */
  read(length = 64): Promise<Buffer> {
    if (!this.inEndpoint) {
      return Promise.reject(
        new USBNotFoundError(
          'No bulk-IN endpoint available (device not open or printer is send-only).',
        ),
      );
    }

    return new Promise<Buffer>((resolve, reject) => {
      this.inEndpoint!.transfer(length, (err, data) => {
        if (err) {
          reject(new USBNotFoundError(err.message));
        } else {
          resolve(data ?? Buffer.alloc(0));
        }
      });
    });
  }

  /**
   * Release the USB interface and close the device.
   *
   * Safe to call even if the device was never opened (no-op).
   *
   * @returns Promise that resolves when the device is fully closed
   */
  async close(): Promise<void> {
    if (!this.device) {
      return;
    }

    if (this.usbInterface) {
      await new Promise<void>((resolve) => {
        this.usbInterface!.release(true, () => resolve());
      });
    }

    this.device.close();
    this.device = null;
    this.usbInterface = null;
    this.outEndpoint = null;
    this.inEndpoint = null;
  }
}
