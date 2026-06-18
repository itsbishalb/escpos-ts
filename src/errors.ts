/**
 * @module escpos-ts/errors
 *
 * Custom error classes for the escpos-ts library.
 *
 * Every error extends {@link EscposError} and carries a numeric
 * {@link EscposError.resultCode} that mirrors the exit-code convention from
 * the original python-escpos library:
 *
 * | Code | Class |
 * |------|-------|
 * | 1    | {@link EscposError} (base) |
 * | 10   | {@link BarcodeTypeError} |
 * | 20   | {@link BarcodeSizeError} |
 * | 30   | {@link BarcodeCodeError} |
 * | 40   | {@link ImageSizeError} |
 * | 41   | {@link ImageWidthError} |
 * | 50   | {@link TextError} |
 * | 60   | {@link CashDrawerError} |
 * | 70   | {@link TabPosError} |
 * | 80   | {@link CharCodeError} |
 * | 90   | {@link DeviceNotFoundError} |
 * | 91   | {@link USBNotFoundError} |
 * | 100  | {@link SetVariableError} |
 * | 200  | {@link ConfigNotFoundError} |
 * | 210  | {@link ConfigSyntaxError} |
 * | 220  | {@link ConfigSectionMissingError} |
 */

/**
 * Base class for all escpos-ts errors.
 *
 * Extends the native `Error` with a numeric {@link resultCode} that can be
 * used for programmatic error handling (e.g. in a POS error logger or retry
 * dispatcher).  Subclasses set their own fixed result codes in their
 * constructors.
 *
 * @example
 * ```ts
 * try {
 *   printer.barcode('', 'CODE128');
 * } catch (e) {
 *   if (e instanceof EscposError) {
 *     console.error(`ESC/POS error ${e.resultCode}: ${e.message}`);
 *   }
 * }
 * ```
 *
 * @since 1.0.0
 */
export class EscposError extends Error {
  /**
   * Numeric result code identifying the error category.
   * Mirrors the exit-code convention from the original python-escpos library.
   * Base value is `1`; subclasses override with their own codes.
   */
  resultCode: number;

  /**
   * @param msg  - Human-readable error message.
   * @param code - Numeric result code (default: `1`).
   */
  constructor(msg: string, code = 1) {
    super(msg);
    this.name = 'EscposError';
    this.resultCode = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when an unrecognised or unsupported barcode type is passed to
 * {@link Escpos.barcode}.
 *
 * Result code: **10**.
 *
 * @example
 * ```ts
 * try {
 *   printer.barcode('12345', 'INVALID_TYPE');
 * } catch (e) {
 *   if (e instanceof BarcodeTypeError) {
 *     console.error('Check your barcode type string.');
 *   }
 * }
 * ```
 *
 * @since 1.0.0
 */
export class BarcodeTypeError extends EscposError {
  /** @param msg - Optional detail (e.g. the unrecognised type name). */
  constructor(msg = '') {
    super(`No Barcode type is defined (${msg})`, 10);
    this.name = 'BarcodeTypeError';
  }
}

/**
 * Thrown when barcode `height` or `width` parameters are outside the valid
 * range accepted by {@link Escpos.barcode}.
 *
 * Valid ranges: `height` 1–255, `width` 2–6.
 *
 * Result code: **20**.
 *
 * @since 1.0.0
 */
export class BarcodeSizeError extends EscposError {
  /** @param msg - Optional detail (e.g. `"height=300"`). */
  constructor(msg = '') {
    super(`Barcode size is out of range (${msg})`, 20);
    this.name = 'BarcodeSizeError';
  }
}

/**
 * Thrown when a barcode code string is missing or fails format validation in
 * {@link Escpos.barcode}.
 *
 * Result code: **30**.
 *
 * @since 1.0.0
 */
export class BarcodeCodeError extends EscposError {
  /** @param msg - Optional detail (e.g. the invalid code string). */
  constructor(msg = '') {
    super(`No Barcode code was supplied (${msg})`, 30);
    this.name = 'BarcodeCodeError';
  }
}

/**
 * Thrown when an image fragment exceeds the maximum height of 255 pixels
 * that the `GS v 0` raster command can encode in a single call.
 *
 * Result code: **40**.
 *
 * @see {@link Escpos.image} — uses `fragmentHeight` to split images before
 *   this error can occur.
 *
 * @since 1.0.0
 */
export class ImageSizeError extends EscposError {
  /** @param msg - Optional detail (e.g. the actual pixel height). */
  constructor(msg = '') {
    super(`Image height is longer than 255px and can't be printed (${msg})`, 40);
    this.name = 'ImageSizeError';
  }
}

/**
 * Thrown when an image's pixel width exceeds the printable width declared by
 * the active printer profile's media settings.
 *
 * Result code: **41**.
 *
 * @see {@link Escpos.image} — checks `profile.profileData.media.width.pixels`.
 *
 * @since 1.0.0
 */
export class ImageWidthError extends EscposError {
  /** @param msg - Optional detail (e.g. `"520 > 512"`). */
  constructor(msg = '') {
    super(`Image width is too large (${msg})`, 41);
    this.name = 'ImageWidthError';
  }
}

/**
 * Thrown when an empty or missing string is passed to {@link Escpos.text}.
 *
 * Result code: **50**.
 *
 * @since 1.0.0
 */
export class TextError extends EscposError {
  /** @param msg - Optional detail. */
  constructor(msg = '') {
    super(`Text string must be supplied to the text() method (${msg})`, 50);
    this.name = 'TextError';
  }
}

/**
 * Thrown when an invalid cash-drawer pin is passed to {@link Escpos.cashdraw}.
 *
 * Valid pins: `2`, `5`, or a 5-element numeric array for a custom DEC sequence.
 *
 * Result code: **60**.
 *
 * @since 1.0.0
 */
export class CashDrawerError extends EscposError {
  /** @param msg - Optional detail (e.g. the invalid pin value). */
  constructor(msg = '') {
    super(`Valid pin must be set to send pulse (${msg})`, 60);
    this.name = 'CashDrawerError';
  }
}

/**
 * Thrown when tab-stop positions passed to a tab-setting command are outside
 * the valid range of 0–16.
 *
 * Result code: **70**.
 *
 * @since 1.0.0
 */
export class TabPosError extends EscposError {
  /** @param msg - Optional detail. */
  constructor(msg = '') {
    super(`Valid tab positions must be in the range 0 to 16 (${msg})`, 70);
    this.name = 'TabPosError';
  }
}

/**
 * Thrown when an invalid character code is used in a command that requires a
 * specific single-byte code point.
 *
 * Result code: **80**.
 *
 * @since 1.0.0
 */
export class CharCodeError extends EscposError {
  /** @param msg - Optional detail. */
  constructor(msg = '') {
    super(`Valid char code must be set (${msg})`, 80);
    this.name = 'CharCodeError';
  }
}

/**
 * Thrown when the target printer device cannot be found or a connection
 * attempt fails.
 *
 * Subclassed by {@link USBNotFoundError} for USB-specific failures.
 *
 * Result code: **90**.
 *
 * @since 1.0.0
 */
export class DeviceNotFoundError extends EscposError {
  /** @param msg - Optional detail (e.g. host:port or error reason). */
  constructor(msg = '') {
    super(`Device not found (${msg})`, 90);
    this.name = 'DeviceNotFoundError';
  }
}

/**
 * Thrown when a USB device matching the requested Vendor ID / Product ID
 * cannot be found on the host, or when no suitable bulk-OUT endpoint exists
 * on the claimed interface.
 *
 * Extends {@link DeviceNotFoundError} with result code **91**.
 *
 * @example
 * ```ts
 * try {
 *   await printer.open();
 * } catch (e) {
 *   if (e instanceof USBNotFoundError) {
 *     console.error('Check USB cable and VID/PID values.');
 *   }
 * }
 * ```
 *
 * @since 1.0.0
 */
export class USBNotFoundError extends DeviceNotFoundError {
  /** @param msg - Optional detail (e.g. `"VID=0x04b8 PID=0x0202"`). */
  constructor(msg = '') {
    super(msg);
    this.resultCode = 91;
    this.message = `USB device not found (${msg})`;
    this.name = 'USBNotFoundError';
  }
}

/**
 * Thrown when a style variable passed to {@link Escpos.set} is outside the
 * valid range — for example, when `customSize` is requested with `width` or
 * `height` outside the 1–8 range.
 *
 * Corresponds to Python `SetVariableError` (result code `100`).
 *
 * @since 1.0.0
 */
export class SetVariableError extends EscposError {
  /** @param msg - Optional detail (e.g. the out-of-range value). */
  constructor(msg = '') {
    super(`Set variable out of range (${msg})`, 100);
    this.name = 'SetVariableError';
  }
}

/**
 * Thrown when a configuration file or resource is not found.
 *
 * Result code: **200**.
 *
 * @since 1.0.0
 */
export class ConfigNotFoundError extends EscposError {
  /** @param msg - Optional detail (e.g. the missing config path). */
  constructor(msg = '') {
    super(`Configuration not found (${msg})`, 200);
    this.name = 'ConfigNotFoundError';
  }
}

/**
 * Thrown when a configuration file exists but contains a syntax error.
 *
 * Result code: **210**.
 *
 * @since 1.0.0
 */
export class ConfigSyntaxError extends EscposError {
  /** @param msg - Optional detail (e.g. the offending line or key). */
  constructor(msg = '') {
    super(`Configuration syntax is invalid (${msg})`, 210);
    this.name = 'ConfigSyntaxError';
  }
}

/**
 * Thrown when a required section is missing from a configuration file.
 *
 * Result code: **220**.
 *
 * @since 1.0.0
 */
export class ConfigSectionMissingError extends EscposError {
  /** @param msg - Optional detail (e.g. the missing section name). */
  constructor(msg = '') {
    super(`Configuration section is missing (${msg})`, 220);
    this.name = 'ConfigSectionMissingError';
  }
}
