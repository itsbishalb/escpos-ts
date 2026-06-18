/**
 * @module escpos-ts/printers/Usb
 *
 * USB printer implementation for ESC/POS printers connected via USB.
 * Uses the `usb` npm package (libusb bindings) to find devices by Vendor ID /
 * Product ID, claim the appropriate interface, and write to the bulk-OUT
 * endpoint.  An optional bulk-IN endpoint is used for status reads.
 *
 * @remarks
 * On Linux, udev rules must grant your user access to the USB device.
 * On Windows, install a WinUSB/libusb-compatible driver (e.g. via Zadig).
 * On macOS, the printer must not be claimed by the `AppleUSBPrinter` driver —
 * use `sudo kextunload -b com.apple.driver.AppleUSBPrinter` if needed.
 */

// src/printers/Usb.ts
import { findByIds, getDeviceList, OutEndpoint, InEndpoint } from 'usb';
import type { Device, Interface, Endpoint } from 'usb';

// USB bulk transfer type constant (libusb value 2)
const LIBUSB_TRANSFER_TYPE_BULK = 2;
import { Escpos } from '../Escpos';
import { USBNotFoundError } from '../errors';

/**
 * Configuration options for the {@link Usb} printer.
 *
 * @since 1.0.0
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
 * Minimal device descriptor returned by {@link Usb.listDevices} and
 * {@link Usb.listPrinters}.
 *
 * @since 1.0.0
 */
export interface UsbDeviceInfo {
  /** USB Vendor ID */
  vendorId: number;
  /** USB Product ID */
  productId: number;
  /** Manufacturer string from USB descriptor (if readable) */
  manufacturer?: string;
  /** Product name string from USB descriptor (if readable) */
  product?: string;
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
 *
 * @since 1.0.0
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
   * Return a flat list of every USB device currently visible to libusb,
   * without any class-based filtering.
   *
   * Useful for quickly enumerating all connected devices when you want to
   * let the caller decide which one is a printer (e.g. GUI device pickers).
   * For printer-only results with string descriptor resolution, use
   * {@link listPrinters} instead.
   *
   * @returns Array of {@link UsbDeviceInfo} objects (synchronous)
   * @since 1.0.0
   */
  static listDevices(): UsbDeviceInfo[] {
    return getDeviceList().map((device) => {
      const desc = device.deviceDescriptor;
      return { vendorId: desc.idVendor, productId: desc.idProduct };
    });
  }

  /**
   * Scan for connected USB printers.
   *
   * Strategy: exclude devices whose class is definitively NOT a printer
   * (HID, hub, audio, video, mass storage, etc.). For everything else,
   * try to confirm via interface class 7. If the OS has claimed the device
   * (common on Windows with usbprint.sys) and we cannot inspect interface
   * descriptors, we include the device anyway — a claimed device on Windows
   * is almost always a printer or printer-adjacent peripheral.
   *
   * After class detection, attempts to read the manufacturer and product name
   * string descriptors by briefly opening the device. This fails gracefully
   * when the device is driver-owned.
   *
   * @returns Promise resolving to an array of printer {@link UsbDeviceInfo} objects
   * @since 1.0.0
   */
  static async listPrinters(): Promise<UsbDeviceInfo[]> {
    // USB device classes that are definitively not printers
    const NON_PRINTER_CLASSES = new Set([
      0x01, // Audio
      0x02, // CDC Control
      0x03, // HID (keyboard, mouse, gamepad)
      0x06, // Still Image (camera)
      0x08, // Mass Storage
      0x09, // Hub
      0x0A, // CDC Data
      0x0B, // Smart Card
      0x0D, // Content Security
      0x0E, // Video
      0x0F, // Personal Healthcare
      0xE0, // Wireless Controller (Bluetooth, RNDIS)
      0xDC, // Diagnostic
    ]);

    const results: UsbDeviceInfo[] = [];

    for (const device of getDeviceList()) {
      const desc = device.deviceDescriptor;
      const devClass = desc.bDeviceClass;

      // Skip devices that are definitely not printers
      if (NON_PRINTER_CLASSES.has(devClass)) continue;

      let isPrinter = devClass === 7; // standard printer class

      if (!isPrinter) {
        // devClass is 0 (per-interface) or 0xFF (vendor-specific):
        // try to confirm via configDescriptor interface class
        try {
          const config = device.configDescriptor;
          if (config?.interfaces) {
            const hasClass7 = config.interfaces.some((iface) =>
              iface.some((alt) => alt.bInterfaceClass === 7),
            );
            if (hasClass7) {
              isPrinter = true;
            } else if (devClass === 0) {
              // Per-interface device but no class-7 interface found.
              // On Windows the OS driver claims the device before libusb
              // can see the interfaces, so configDescriptor may be empty
              // even for a real printer. Be permissive.
              isPrinter = config.interfaces.length === 0;
            }
          } else {
            // configDescriptor returned null/undefined — device is likely
            // claimed by the OS driver (usbprint.sys on Windows).
            // Include it: a claimed per-interface device is most likely a printer.
            isPrinter = devClass === 0 || devClass === 0xFF;
          }
        } catch {
          // Cannot inspect descriptors at all — include if class is ambiguous
          isPrinter = devClass === 0 || devClass === 0xFF;
        }
      }

      if (!isPrinter) continue;

      const info: UsbDeviceInfo = {
        vendorId: desc.idVendor,
        productId: desc.idProduct,
      };

      // Try to read manufacturer / product strings by opening the device
      try {
        device.open();
        const readStr = (idx: number): Promise<string> =>
          new Promise((resolve) => {
            if (idx === 0) { resolve(''); return; }
            device.getStringDescriptor(idx, (_err, val) => resolve(val ?? ''));
          });
        info.manufacturer = (await readStr(desc.iManufacturer)) || undefined;
        info.product      = (await readStr(desc.iProduct))      || undefined;
        device.close();
      } catch {
        try { device.close(); } catch { /* already closed */ }
      }

      results.push(info);
    }

    return results;
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
   * @since 1.0.0
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
   * @since 1.0.0
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
   * @since 1.0.0
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
   * @since 1.0.0
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
