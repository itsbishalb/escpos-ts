/**
 * @packageDocumentation
 *
 * **escpos-ts** — A strictly-typed TypeScript port of the
 * [python-escpos](https://github.com/python-escpos/python-escpos) library for
 * ESC/POS thermal receipt printers.
 *
 * ## Quick start
 *
 * ```ts
 * import { Network, QR_ECLEVEL_M } from 'escpos-ts';
 *
 * const printer = new Network({ host: '192.168.1.100', port: 9100 });
 * await printer.open();
 *
 * printer.hw('INIT');
 * printer.setWithDefault({ bold: true, align: 'center' });
 * printer.textln('My Shop');
 * printer.setWithDefault();
 *
 * printer.textln('Ref: Invoice #INV-10042');
 * printer.barcode('012345678905', 'EAN13');
 *
 * await printer.qr('https://myshop.com', { ec: QR_ECLEVEL_M });
 *
 * printer.cut();
 * await printer.close();
 * ```
 *
 * ## Connection types
 *
 * | Class | Transport | Package |
 * |-------|-----------|---------|
 * | {@link Network} | TCP/IP (`net.Socket`) | built-in Node.js |
 * | {@link Usb}     | USB bulk transfer | `usb` (libusb) |
 * | {@link Dummy}   | In-memory buffer  | — |
 *
 * ## Printer profiles
 *
 * Use {@link ProfileManager.listProfiles} to see available profiles and
 * {@link ProfileManager.getProfile} to resolve one.  Pass the profile name to
 * any printer constructor via the `profileName` option.
 */

// ── Constants & utilities ────────────────────────────────────────────────────
export * from './constants';

// ── Error classes ────────────────────────────────────────────────────────────
export * from './errors';

// ── Profile system ───────────────────────────────────────────────────────────
export * from './profiles/types';
export { ProfileManager } from './profiles/ProfileManager';

// ── Connection interface ─────────────────────────────────────────────────────
export type { IPrinterConnection } from './interfaces/IPrinterConnection';

// ── Code pages ───────────────────────────────────────────────────────────────
export { CodePages } from './codepages/CodePages';
export type { CodePageEntry } from './codepages/types';

// ── Encoding ─────────────────────────────────────────────────────────────────
export { MagicEncode } from './MagicEncode';

// ── Base class ───────────────────────────────────────────────────────────────
export { Escpos } from './Escpos';
export type { TextStyleOptions, BarcodeOptions, QrOptions, ImageOptions, Alignment } from './Escpos';

// ── Printer implementations ──────────────────────────────────────────────────
export { Dummy } from './printers/Dummy';
export { Network } from './printers/Network';
export { Usb } from './printers/Usb';
export type { UsbConfig, UsbDeviceInfo } from './printers/Usb';

// ── Image & QR helpers ───────────────────────────────────────────────────────
export { EscposImage } from './image/EscposImage';
export { QrHelper } from './qr/QrHelper';
export type { QrOptions as QrHelperOptions } from './qr/QrHelper';
