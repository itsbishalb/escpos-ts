// src/Escpos.ts
import {
  ESC, GS, NUL,
  TXT_STYLE, TXT_NORMAL, TXT_SIZE,
  LINESPACING_RESET, LINESPACING_FUNCS,
  HW_INIT, HW_SELECT, HW_RESET,
  CD_KICK_2, CD_KICK_5, cashDrawerDecSequence,
  PAPER_FULL_CUT, PAPER_PART_CUT,
  BARCODE_HEIGHT, BARCODE_WIDTH,
  BARCODE_FONT_A, BARCODE_FONT_B,
  BARCODE_TXT_OFF, BARCODE_TXT_ABV, BARCODE_TXT_BLW, BARCODE_TXT_BTH,
  BARCODE_TYPES, BARCODE_FORMATS,
  LINE_DISPLAY_OPEN, LINE_DISPLAY_CLOSE, LINE_DISPLAY_CLEAR,
  QR_ECLEVEL_L, QR_ECLEVEL_M, QR_ECLEVEL_Q, QR_ECLEVEL_H,
  QR_MODEL_1, QR_MODEL_2, QR_MICRO,
  intLowHigh,
  setFont,
} from './constants';
import {
  BarcodeTypeError, BarcodeSizeError, BarcodeCodeError,
  CashDrawerError, SetVariableError, TabPosError, ImageWidthError,
} from './errors';
import { MagicEncode } from './MagicEncode';
import { ProfileManager } from './profiles/ProfileManager';
import type { PrinterProfile } from './profiles/types';

/**
 * @module escpos-ts/Escpos
 *
 * Abstract base class for all ESC/POS printer implementations.
 *
 * Provides the complete formatting, text, barcode, QR code, and image API.
 * Concrete subclasses ({@link Network}, {@link Usb}, {@link Dummy}) implement
 * the three abstract methods `_raw()`, `open()`, and `close()`.
 */

export type Alignment = 'left' | 'center' | 'right' | 'justify';
export type FontName = 'a' | 'b';

/**
 * Style options for the {@link Escpos.set} and {@link Escpos.setWithDefault} methods.
 *
 * All fields are optional.  Omitted fields leave the corresponding printer
 * attribute unchanged (for {@link Escpos.set}) or use sensible defaults
 * (for {@link Escpos.setWithDefault}).
 *
 * @since 1.0.0
 */
export interface TextStyleOptions {
  /** Horizontal text alignment. */
  align?: 'left' | 'center' | 'right';
  /** Font identifier: `'a'` for Font A, `'b'` for Font B. */
  font?: string;
  /** Enable or disable bold text. */
  bold?: boolean;
  /** Underline thickness: `0` = off, `1` = single, `2` = double. */
  underline?: 0 | 1 | 2;
  /** Horizontal character width multiplier (1–8×). */
  width?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  /** Vertical character height multiplier (1–8×). */
  height?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  /** Print density (0–8; 9 = use printer default). */
  density?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  /** Enable white-on-black character inversion. */
  invert?: boolean;
  /** Enable character smoothing. */
  smooth?: boolean;
  /** Enable 90-degree character rotation. */
  flip?: boolean;
  /** Reset character size to 1×1 (cancels double-width/height). */
  normalTextSize?: boolean;
  /** Print characters at double width. */
  doubleWidth?: boolean;
  /** Print characters at double height. */
  doubleHeight?: boolean;
  /** Enable custom `width` × `height` size multipliers (auto-set when w or h > 1). */
  customSize?: boolean;
}

/**
 * Options for {@link Escpos.barcode}.
 *
 * @since 1.0.0
 */
export interface BarcodeOptions {
  /** Barcode height in dots (1–255; default: 64). */
  height?: number;
  /** Module width / bar width in dots (2–6; default: 3). */
  width?: number;
  /** Position of human-readable text relative to the barcode (default: `'BELOW'`). */
  pos?: 'ABOVE' | 'BELOW' | 'BOTH' | 'OFF';
  /** Font for human-readable text: `'A'` or `'B'` (default: `'A'`). */
  font?: 'A' | 'B';
  /** Centre the barcode on the receipt (default: `true`). */
  alignCenter?: boolean;
  /** ESC/POS barcode function type: `'A'` or `'B'` (auto-detected if omitted). */
  functionType?: 'A' | 'B';
  /** Validate code format before sending to printer (default: `true`). */
  check?: boolean;
}

/**
 * Options for {@link Escpos.qr}.
 *
 * @since 1.0.0
 */
export interface QrOptions {
  /** Error correction level constant (`QR_ECLEVEL_*`; default: `QR_ECLEVEL_L`). */
  ec?: number;
  /** Module size in pixels, 1–16 (default: 3). */
  size?: number;
  /** QR model constant (`QR_MODEL_1`, `QR_MODEL_2`, `QR_MICRO`; default: `QR_MODEL_2`). */
  model?: number;
  /** Use native printer QR rendering (`true`) or software-generated raster (`false`). Default: `false`. */
  native?: boolean;
  /** Centre the QR code horizontally on the receipt (default: `false`). */
  center?: boolean;
}

/**
 * Options for {@link Escpos.image}.
 *
 * @since 1.0.0
 */
export interface ImageOptions {
  /** Print in high vertical density — pixels are not stretched vertically (default: `true`). */
  highDensityVertical?: boolean;
  /** Print in high horizontal density — pixels are not stretched horizontally (default: `true`). */
  highDensityHorizontal?: boolean;
  /**
   * ESC/POS image printing implementation to use (default: `'bitImageRaster'`):
   * - `'bitImageRaster'` — `GS v 0` raster command; widest compatibility.
   * - `'graphics'`       — `GS ( L` graphics command; better alignment on some models.
   * - `'bitImageColumn'` — `ESC *` column command; required for IT80-002 and similar.
   */
  impl?: 'bitImageRaster' | 'graphics' | 'bitImageColumn';
  /** Maximum fragment height in pixels; images taller than this are split (default: 960). */
  fragmentHeight?: number;
  /** Centre the image within the printer's media width (default: `false`). */
  center?: boolean;
}

/** NW7/CODABAR normalised lookup — strips non-alnum, uppercases */
const normaliseBarcodeName = (name: string): string =>
  name.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

const HW_BARCODE_NAMES: Record<string, string> = {};
for (const [ft, names] of Object.entries(BARCODE_TYPES)) {
  for (const name of Object.keys(names)) {
    HW_BARCODE_NAMES[normaliseBarcodeName(name)] = name;
  }
}

// Suppress unused variable warnings for imports used only in type positions or future methods
void (TabPosError);

/**
 * Abstract base class for ESC/POS thermal receipt printers.
 *
 * Provides the complete ESC/POS formatting API — text, styles, barcodes, QR
 * codes, and images.  Hardware transport is handled by subclasses:
 *
 * - {@link Network} — TCP/IP printers via Node.js `net.Socket`.
 * - {@link Usb}     — USB printers via the `usb` npm package (libusb).
 * - {@link Dummy}   — In-memory buffer for testing without hardware.
 *
 * **Subclassing:** Implement `_raw(data: Buffer): void`, `open(): Promise<void>`,
 * and `close(): Promise<void>`.  All other methods are provided by this class.
 *
 * @example
 * ```ts
 * const printer = new Network({ host: '192.168.1.100' });
 * await printer.open();
 *
 * printer.setWithDefault({ bold: true, align: 'center' });
 * printer.textln('ACME Corp');
 * printer.setWithDefault(); // reset to defaults
 *
 * printer.barcode('12345678', 'EAN8');
 * printer.cut();
 *
 * await printer.close();
 * ```
 *
 * @since 1.0.0
 */
export abstract class Escpos {
  protected readonly profile: PrinterProfile;
  protected readonly magic: MagicEncode;

  /**
   * @param profileName - Printer profile name from the capabilities database
   *   (e.g. `"TM-T88V"`).  Defaults to `"default"`.
   *   See {@link ProfileManager.listProfiles} for available names.
   */
  constructor(profileName?: string) {
    this.profile = ProfileManager.getProfile(profileName);
    this.magic = new MagicEncode((data) => this._raw(data), this.profile);
  }

  /**
   * Send a raw `Buffer` of bytes directly to the printer hardware.
   *
   * All higher-level methods ultimately call this.  Subclasses must implement
   * it to write to the underlying transport (TCP socket, USB endpoint, etc.).
   *
   * @param data - Buffer containing ESC/POS command bytes.
   */
  abstract _raw(data: Buffer): void;

  /**
   * Open the connection to the printer.
   *
   * Must be called before any print commands are sent.  Subclass behaviour:
   * - {@link Network.open} — establishes a TCP socket.
   * - {@link Usb.open}     — opens and claims the USB device.
   * - {@link Dummy.open}   — no-op (always resolves immediately).
   *
   * @returns Promise that resolves when the printer is ready to accept data.
   */
  abstract open(): Promise<void>;

  /**
   * Close the connection to the printer and release all resources.
   *
   * Safe to call even if not connected.  Subclass behaviour:
   * - {@link Network.close} — destroys the TCP socket.
   * - {@link Usb.close}     — releases the USB interface and closes the device.
   * - {@link Dummy.close}   — no-op.
   *
   * @returns Promise that resolves when all resources have been released.
   */
  abstract close(): Promise<void>;

  // ── Text ──────────────────────────────────────────────────────────────────

  /**
   * Print a string using automatic encoding selection.
   *
   * Characters are encoded via {@link MagicEncode}, which automatically
   * selects the best code page for each segment of the string and emits
   * the necessary `ESC t n` code-page-switch commands.
   *
   * @param txt - UTF-8 string to print.
   * @since 1.0.0
   */
  text(txt: string): void {
    this.magic.write(txt);
  }

  /**
   * Print a string followed by a line feed (`\n`).
   *
   * Equivalent to `printer.text(txt + '\n')`.
   *
   * @param txt - UTF-8 string to print (default: `''` — prints a blank line).
   * @since 1.0.0
   */
  textln(txt = ''): void {
    this.text(`${txt}\n`);
  }

  /**
   * Print `count` blank lines.
   *
   * @param count - Number of line feeds to emit (default: 1; must be ≥ 0).
   * @throws `RangeError` if `count` is negative.
   * @since 1.0.0
   */
  ln(count = 1): void {
    if (count < 0) throw new RangeError('count must be >= 0');
    if (count > 0) this.text('\n'.repeat(count));
  }

  /**
   * Print a word-wrapped text block.
   *
   * Wraps `txt` at word boundaries to fit within the column width of the
   * selected font, as reported by the active printer profile.
   *
   * @param txt     - UTF-8 string to wrap and print.
   * @param font    - Font to use for column-width lookup (`'a'` or `'b'`; default: `'a'`).
   * @param columns - Override column count (uses profile value if omitted).
   * @since 1.0.0
   */
  blockText(txt: string, font: FontName = 'a', columns?: number): void {
    const cols = columns ?? this.profile.getColumns(font);
    this.text(wordWrap(txt, cols));
  }

  /**
   * Print a row of text in software-defined columns.
   *
   * Lays out `textList` into adjacent fixed-width columns, word-wrapping each
   * cell and aligning content per the corresponding `align` entry.  Outputs
   * one `textln()` call per row of the resulting grid.
   *
   * @param textList - Array of strings, one per column.
   * @param widths   - Total line width (split evenly) or per-column width array.
   * @param align    - Alignment for all columns or per-column alignment array.
   *
   * @example
   * ```ts
   * // Receipt item line: name left-aligned, price right-aligned
   * printer.softwareColumns(['Americano', '$3.50'], [30, 10], ['left', 'right']);
   * ```
   *
   * @since 1.0.0
   */
  softwareColumns(
    textList: string[],
    widths: number | number[],
    align: Alignment | Alignment[],
  ): void {
    const n = textList.length;
    const widthArr = Array.isArray(widths) ? widths : [Math.round((widths as number) / n)];
    const resolvedWidths = repeatLast(widthArr, n);
    const alignArr = Array.isArray(align) ? align : [align];
    const resolvedAlign = repeatLast(alignArr, n);

    const wrapped = textList.map((t, i) => wordWrapLines(t, resolvedWidths[i]));
    const maxLen = Math.max(0, ...wrapped.map(w => w.length));
    for (let row = 0; row < maxLen; row++) {
      const line = textList.map((_, col) => {
        const cell = wrapped[col][row] ?? '';
        return padText(cell, resolvedWidths[col], resolvedAlign[col]);
      });
      this.textln(line.join(''));
    }
  }

  // ── Style ─────────────────────────────────────────────────────────────────

  /**
   * Apply ESC/POS text style attributes.
   *
   * Each field in `opts` that is defined emits the corresponding ESC/POS
   * command immediately.  Omitted fields are not changed on the printer.
   *
   * For size changes, exactly one of `customSize`, `doubleWidth`,
   * `doubleHeight`, or `normalTextSize` should be set.
   *
   * @param opts - Style attributes to apply; see {@link TextStyleOptions}.
   * @throws {@link SetVariableError} if `customSize` is set but `width` or
   *   `height` is outside the 1–8 range.
   * @since 1.0.0
   */
  set(opts: TextStyleOptions): void {
    const {
      customSize, doubleWidth, doubleHeight, normalTextSize,
      bold, underline, font, align, density, invert, smooth, flip,
      width, height,
    } = opts;

    if (customSize) {
      if (
        width !== undefined && height !== undefined &&
        width >= 1 && width <= 8 && height >= 1 && height <= 8
      ) {
        const sizeByte = TXT_STYLE.width[width] + TXT_STYLE.height[height];
        this._raw(Buffer.concat([TXT_SIZE, Buffer.from([sizeByte])]));
      } else {
        throw new SetVariableError('width and height must be 1-8 for customSize');
      }
    } else if (normalTextSize || doubleWidth || doubleHeight) {
      this._raw(TXT_NORMAL);
      if (doubleWidth && doubleHeight) this._raw(TXT_STYLE.size['2x']);
      else if (doubleWidth)            this._raw(TXT_STYLE.size['2w']);
      else if (doubleHeight)           this._raw(TXT_STYLE.size['2h']);
      else                             this._raw(TXT_STYLE.size.normal);
    }

    if (flip    !== undefined) this._raw(TXT_STYLE.flip[String(flip)    as 'true' | 'false']);
    if (smooth  !== undefined) this._raw(TXT_STYLE.smooth[String(smooth) as 'true' | 'false']);
    if (bold    !== undefined) this._raw(TXT_STYLE.bold[String(bold)    as 'true' | 'false']);
    if (underline !== undefined) this._raw(TXT_STYLE.underline[underline as 0 | 1 | 2]);
    if (font !== undefined) {
      const idx = this.profile.getFont(font);
      this._raw(setFont(Buffer.from([idx])));
    }
    if (align   !== undefined) this._raw(TXT_STYLE.align[align]);
    if (density !== undefined && density !== 9) {
      this._raw(TXT_STYLE.density[density as unknown as 0]);
    }
    if (invert  !== undefined) this._raw(TXT_STYLE.invert[String(invert) as 'true' | 'false']);
  }

  /**
   * Apply text styles with full defaults merged in.
   *
   * Merges `opts` over a complete default set (`left` align, Font A, no
   * bold, no underline, 1×1 size, density 9) before calling {@link set}.
   * Also auto-enables `customSize` when `width` or `height` > 1 is requested
   * without an explicit size mode, so callers do not need to set the flag manually.
   *
   * Calling with no arguments resets the printer to standard text defaults.
   *
   * @param opts - Partial style overrides (default: `{}` — full reset).
   *
   * @example
   * ```ts
   * printer.setWithDefault({ bold: true, align: 'center', height: 2 });
   * printer.textln('TOTAL');
   * printer.setWithDefault(); // reset all styles
   * ```
   *
   * @since 1.0.0
   */
  setWithDefault(opts: TextStyleOptions = {}): void {
    const merged: TextStyleOptions = {
      align: 'left',
      font: 'a',
      bold: false,
      underline: 0,
      width: 1,
      height: 1,
      density: 9,
      invert: false,
      smooth: false,
      flip: false,
      doubleWidth: false,
      doubleHeight: false,
      customSize: false,
      ...opts,
    };
    // Auto-enable customSize when numeric width/height > 1 and no other size
    // mode was explicitly requested — callers shouldn't need to know the flag.
    if (
      !merged.customSize && !merged.doubleWidth && !merged.doubleHeight &&
      ((merged.width ?? 1) > 1 || (merged.height ?? 1) > 1)
    ) {
      merged.customSize = true;
    }
    const { customSize, doubleWidth, doubleHeight } = merged;
    merged.normalTextSize = !customSize && !doubleWidth && !doubleHeight;
    this.set(merged);
  }

  /**
   * Set or reset the line spacing.
   *
   * When called without arguments, resets line spacing to the printer default
   * (`ESC 2`).  When `spacing` is provided, sets the line spacing to
   * `spacing / divisor` inches per dot using the matching ESC/POS command:
   *
   * | Divisor | Command | Range |
   * |---------|---------|-------|
   * | 60      | `ESC A` | 0–85 |
   * | 180     | `ESC 3` | 0–255 |
   * | 360     | `ESC +` | 0–255 |
   *
   * @param spacing - Spacing value in dots (omit to reset).
   * @param divisor - Unit divisor: `60`, `180`, or `360` (default: `180`).
   * @throws `RangeError` if `divisor` is not one of `60 | 180 | 360`.
   * @throws `RangeError` if `spacing` is outside the valid range for the divisor.
   * @since 1.0.0
   */
  lineSpacing(spacing?: number, divisor: 60 | 180 | 360 = 180): void {
    if (spacing === undefined) {
      this._raw(LINESPACING_RESET);
      return;
    }
    if (!(divisor in LINESPACING_FUNCS)) throw new RangeError('divisor must be 60, 180, or 360');
    if (divisor !== 60 && !(spacing >= 0 && spacing <= 255))
      throw new RangeError('spacing must be 0-255 for divisor 180/360');
    if (divisor === 60 && !(spacing >= 0 && spacing <= 85))
      throw new RangeError('spacing must be 0-85 for divisor 60');
    this._raw(Buffer.concat([LINESPACING_FUNCS[divisor], Buffer.from([spacing])]));
  }

  // ── Hardware ──────────────────────────────────────────────────────────────

  /**
   * Send a hardware control command to the printer.
   *
   * | Action   | Command | Effect |
   * |----------|---------|--------|
   * | `'INIT'` | `ESC @` | Clear print buffer and reset modes to defaults |
   * | `'SELECT'` | `ESC =` | Select printer as the active peripheral |
   * | `'RESET'` | `ESC ?` | Soft reset |
   *
   * @param action - One of `'INIT'`, `'SELECT'`, or `'RESET'`.
   * @throws `Error` if `action` is not one of the three valid values.
   * @since 1.0.0
   */
  hw(action: 'INIT' | 'SELECT' | 'RESET'): void {
    const map: Record<string, Buffer> = {
      INIT: HW_INIT,
      SELECT: HW_SELECT,
      RESET: HW_RESET,
    };
    const cmd = map[action.toUpperCase()];
    if (!cmd) throw new Error(`Unknown hw action: ${action}`);
    this._raw(cmd);
  }

  /**
   * Cut the paper.
   *
   * Feeds 6 lines before cutting unless `feed` is `false`.  Falls back to a
   * full cut when the profile does not support partial cuts, and vice versa.
   *
   * @param mode - `'FULL'` (default) for a complete cut, `'PART'` to leave
   *   a small uncut section.
   * @param feed - Feed paper before cutting (default: `true`).
   * @throws `Error` if `mode` is not `'FULL'` or `'PART'`.
   * @since 1.0.0
   */
  cut(mode: 'FULL' | 'PART' = 'FULL', feed = true): void {
    if (!feed) {
      this._raw(Buffer.concat([GS, Buffer.from([0x56, 0x42, 0x00])]));
      return;
    }
    this.printAndFeed(6);
    const m = mode.toUpperCase();
    if (m !== 'FULL' && m !== 'PART') throw new Error("mode must be 'FULL' or 'PART'");
    if (m === 'PART') {
      this._raw(this.profile.supports('paperPartCut') ? PAPER_PART_CUT : PAPER_FULL_CUT);
    } else {
      this._raw(this.profile.supports('paperFullCut') ? PAPER_FULL_CUT : PAPER_PART_CUT);
    }
  }

  /**
   * Print and feed `n` lines (`ESC d n`).
   *
   * @param lines - Number of lines to feed (0–255).
   * @since 1.0.0
   */
  printAndFeed(lines: number): void {
    this._raw(Buffer.concat([ESC, Buffer.from('d'), Buffer.from([lines])]));
  }

  /**
   * Send a cash-drawer open pulse.
   *
   * @param pin - Cash-drawer pin: `2`, `5`, or a 5-element array
   *   `[esc, p, m, t1, t2]` for a custom DEC sequence.
   * @throws {@link CashDrawerError} if `pin` is not `2`, `5`, or a valid 5-element array.
   * @since 1.0.0
   */
  cashdraw(pin: number | number[]): void {
    if (pin === 2) { this._raw(CD_KICK_2); return; }
    if (pin === 5) { this._raw(CD_KICK_5); return; }
    if (Array.isArray(pin) && pin.length === 5) {
      this._raw(cashDrawerDecSequence(
        ...(pin as [number, number, number, number, number]),
      ));
      return;
    }
    throw new CashDrawerError(`Invalid pin: ${String(pin)}`);
  }

  // ── Barcode ───────────────────────────────────────────────────────────────

  /**
   * Validate a barcode code string against the format rules for a given barcode type.
   *
   * Checks that the code length falls within an allowed range and that the
   * string matches the required character set for the barcode type.
   *
   * @param bc   - Barcode type name (e.g. `'CODE128'`, `'EAN13'`).
   * @param code - Barcode data string to validate.
   * @returns `true` if the code is valid for the given type.
   * @since 1.0.0
   */
  static checkBarcode(bc: string, code: string): boolean {
    const fmt = BARCODE_FORMATS[bc];
    if (!fmt) return false;
    const [bounds, regex] = fmt;
    return (
      bounds.some(([min, max]) => code.length >= min && code.length <= max) &&
      regex.test(code)
    );
  }

  /**
   * Print a hardware barcode.
   *
   * Sends the appropriate `GS k` sequence for the requested barcode type and
   * function type.  Supports all types defined in {@link BARCODE_TYPES}
   * (UPC-A, UPC-E, EAN8, EAN13, CODE39, ITF, NW7/CODABAR, CODE93, CODE128,
   * and GS1 variants for Function Type B).
   *
   * @param code - Barcode data string.
   * @param bc   - Barcode type name (e.g. `'CODE128'`, `'EAN13'`).
   *   Names are normalised (non-alphanumeric removed, uppercased) before lookup.
   * @param opts - Optional barcode appearance settings; see {@link BarcodeOptions}.
   *
   * @throws {@link BarcodeTypeError} if the type is unrecognised or unsupported.
   * @throws {@link BarcodeCodeError} if `code` fails format validation and
   *   `opts.check` is `true` (default).
   * @throws {@link BarcodeSizeError} if `height` or `width` are out of range.
   *
   * @example
   * ```ts
   * printer.barcode('012345678905', 'EAN13', { pos: 'BELOW', height: 80 });
   * printer.barcode('{B12345678', 'CODE128', { functionType: 'B' });
   * ```
   *
   * @since 1.0.0
   */
  barcode(code: string, bc: string, opts: BarcodeOptions = {}): void {
    const {
      height = 64, width = 3, pos = 'BELOW', font = 'A',
      alignCenter = true, functionType, check = true,
    } = opts;

    const bcAlnum = normaliseBarcodeName(bc);
    const hwBc = HW_BARCODE_NAMES[bcAlnum];
    if (!hwBc) throw new BarcodeTypeError(`Not supported or unknown barcode: ${bc}`);

    const ftGuess =
      Object.entries(BARCODE_TYPES).find(([, names]) => hwBc in names)?.[0] ?? '';
    const ft = (functionType ?? ftGuess).toUpperCase() as 'A' | 'B';
    if (!ft || !BARCODE_TYPES[ft]) throw new BarcodeTypeError(`No function type for ${bc}`);

    if (check && !Escpos.checkBarcode(hwBc, code)) throw new BarcodeCodeError(code);

    if (alignCenter) this._raw(TXT_STYLE.align.center);
    if (height < 1 || height > 255) throw new BarcodeSizeError(`height=${height}`);
    if (width < 2 || width > 6)     throw new BarcodeSizeError(`width=${width}`);

    this._raw(Buffer.concat([BARCODE_HEIGHT, Buffer.from([height])]));
    this._raw(Buffer.concat([BARCODE_WIDTH,  Buffer.from([width])]));
    this._raw(font.toUpperCase() === 'B' ? BARCODE_FONT_B : BARCODE_FONT_A);

    const posMap: Record<string, Buffer> = {
      OFF:   BARCODE_TXT_OFF,
      ABOVE: BARCODE_TXT_ABV,
      BOTH:  BARCODE_TXT_BTH,
    };
    this._raw(posMap[pos.toUpperCase()] ?? BARCODE_TXT_BLW);

    this._raw(BARCODE_TYPES[ft][hwBc]);
    if (ft === 'B') this._raw(Buffer.from([code.length]));
    if (!code) throw new BarcodeCodeError();
    this._raw(Buffer.from(code, 'ascii'));
    if (ft === 'A') this._raw(NUL);
  }

  // ── QR ────────────────────────────────────────────────────────────────────

  /**
   * Print a QR code.
   *
   * Two rendering modes are available, controlled by `opts.native`:
   *
   * - **Software mode** (`native: false`, default) — generates the QR matrix
   *   locally using the `qrcode` package and sends it as a raster image via
   *   {@link image}.  Works on all printers that support raster images.
   *
   * - **Native mode** (`native: true`) — sends the five `GS ( k` sub-commands
   *   (set model, size, error correction, store data, print) directly.
   *   Requires the printer to have a built-in QR engine (most Epson TM series).
   *
   * @param content - The string to encode (UTF-8).
   * @param opts    - QR code appearance options; see {@link QrOptions}.
   *
   * @throws `Error` if `ec`, `size`, or `model` values are outside valid ranges.
   *
   * @example
   * ```ts
   * await printer.qr('https://example.com', { size: 4, ec: QR_ECLEVEL_M });
   * ```
   *
   * @since 1.0.0
   */
  async qr(content: string, opts: QrOptions = {}): Promise<void> {
    const {
      ec = QR_ECLEVEL_L, size = 3, model = QR_MODEL_2,
      native = false, center = false,
    } = opts;

    const validEc = [QR_ECLEVEL_L, QR_ECLEVEL_M, QR_ECLEVEL_Q, QR_ECLEVEL_H];
    if (!validEc.includes(ec)) throw new Error('Invalid error correction level');
    if (size < 1 || size > 16) throw new Error('size must be 1-16');
    if (![QR_MODEL_1, QR_MODEL_2, QR_MICRO].includes(model)) throw new Error('Invalid QR model');
    if (!content) return;

    if (!native) {
      const { QrHelper } = await import('./qr/QrHelper');
      const qrBytes = QrHelper.generate(content, { model, size, eclevel: ec });
      if (center) this._raw(Buffer.from([0x1b, 0x61, 0x01])); // ESC a 1 — center align
      this._raw(qrBytes);
      if (center) this._raw(Buffer.from([0x1b, 0x61, 0x00])); // ESC a 0 — left align restore
      return;
    }

    const cn = Buffer.from('1');
    this._send2dCodeData(Buffer.from([65]), cn, Buffer.from([48 + model, 0]));
    this._send2dCodeData(Buffer.from([67]), cn, Buffer.from([size]));
    this._send2dCodeData(Buffer.from([69]), cn, Buffer.from([48 + ec]));
    this._send2dCodeData(Buffer.from([80]), cn, Buffer.from(content, 'utf8'), Buffer.from('0'));
    this._send2dCodeData(Buffer.from([81]), cn, Buffer.alloc(0), Buffer.from('0'));
  }

  private _send2dCodeData(
    fn: Buffer,
    cn: Buffer,
    data: Buffer,
    m = Buffer.alloc(0),
  ): void {
    const header = intLowHigh(data.length + m.length + 2, 2);
    this._raw(Buffer.concat([GS, Buffer.from('(k'), header, cn, fn, m, data]));
  }

  // ── Image ─────────────────────────────────────────────────────────────────

  /**
   * Print an image from a file path or raw image `Buffer`.
   *
   * Supported formats: PNG, JPEG, BMP, GIF, TIFF.
   *
   * The image is:
   *  1. Loaded and decoded (alpha channel composited onto white background).
   *  2. Converted to greyscale and thresholded at luminance 128.
   *  3. Optionally centred within the profile's media width.
   *  4. Split into vertical fragments if taller than `fragmentHeight`.
   *  5. Encoded using the selected `impl` and written via `_raw()`.
   *
   * **`impl` options:**
   * - `'bitImageRaster'` (default) — `GS v 0`; widest printer compatibility.
   * - `'graphics'`                 — `GS ( L`; better alignment on some models.
   * - `'bitImageColumn'`           — `ESC *`; required for printers like IT80-002.
   *
   * @param source - Absolute file path or raw image `Buffer`.
   * @param opts   - Image rendering options; see {@link ImageOptions}.
   *
   * @throws {@link ImageWidthError} if the image is wider than the profile's
   *   declared media width.
   *
   * @example
   * ```ts
   * await printer.image('./receipt-logo.png', { center: true });
   * await printer.image('./receipt-logo.png', { impl: 'bitImageColumn' });
   * ```
   *
   * @since 1.0.0
   */
  async image(source: string | Buffer, opts: ImageOptions = {}): Promise<void> {
    const { EscposImage } = await import('./image/EscposImage');
    const im = await EscposImage.load(source);
    await this._renderImage(im, opts, EscposImage);
  }

  /**
   * Internal image renderer.  Accepts a pre-loaded `EscposImage` so that the
   * fragment-recursion path can reuse the already-decoded bitmap without going
   * through the file-loading / MIME-detection pipeline again.
   */
  private async _renderImage(
    im: import('./image/EscposImage').EscposImage,
    opts: ImageOptions,
    EscposImage: typeof import('./image/EscposImage').EscposImage,
  ): Promise<void> {
    const {
      highDensityVertical = true,
      highDensityHorizontal = true,
      impl = 'bitImageRaster',
      fragmentHeight = 960,
      center = false,
    } = opts;

    try {
      const profileMedia = (this.profile.profileData as unknown as Record<string, unknown>)?.['media'];
      const maxWidthRaw =
        (profileMedia as Record<string, Record<string, number>> | undefined)
          ?.['width']?.['pixels'];
      const maxWidth = Number(maxWidthRaw);
      if (!isNaN(maxWidth)) {
        if (im.width > maxWidth) throw new ImageWidthError(`${im.width} > ${maxWidth}`);
        if (center) im.center(maxWidth);
      }
    } catch (e) {
      if (e instanceof ImageWidthError) throw e;
    }

    if (im.height > fragmentHeight) {
      for (const fragment of im.split(fragmentHeight)) {
        await this._renderImage(fragment, { ...opts, center: false }, EscposImage);
      }
      return;
    }

    if (impl === 'bitImageRaster') {
      const densityByte =
        (highDensityHorizontal ? 0 : 1) + (highDensityVertical ? 0 : 2);
      const header = Buffer.concat([
        GS, Buffer.from('v0'), Buffer.from([densityByte]),
        intLowHigh(im.widthBytes, 2), intLowHigh(im.height, 2),
      ]);
      this._raw(Buffer.concat([header, im.toRasterFormat()]));
    }

    if (impl === 'graphics') {
      const imgHeader = Buffer.concat([
        intLowHigh(im.width, 2), intLowHigh(im.height, 2),
      ]);
      const tone = Buffer.from('0');
      const colors = Buffer.from('1');
      const ym = Buffer.from([highDensityVertical   ? 0x01 : 0x02]);
      const xm = Buffer.from([highDensityHorizontal ? 0x01 : 0x02]);
      this._imageSendGraphicsData(
        Buffer.from('0'),
        Buffer.from('p'),
        Buffer.concat([tone, xm, ym, colors, imgHeader, im.toRasterFormat()]),
      );
      this._imageSendGraphicsData(Buffer.from('0'), Buffer.from('2'), Buffer.alloc(0));
    }

    if (impl === 'bitImageColumn') {
      const densityByte =
        (highDensityHorizontal ? 1 : 0) + (highDensityVertical ? 32 : 0);
      const header = Buffer.concat([
        ESC, Buffer.from('*'), Buffer.from([densityByte]), intLowHigh(im.width, 2),
      ]);
      const out: Buffer[] = [Buffer.concat([ESC, Buffer.from('3'), Buffer.from([16])])];
      for (const blob of im.toColumnFormat(highDensityVertical)) {
        out.push(Buffer.concat([header, blob, Buffer.from('\n')]));
      }
      out.push(Buffer.concat([ESC, Buffer.from('2')]));
      this._raw(Buffer.concat(out));
    }
  }

  private _imageSendGraphicsData(m: Buffer, fn: Buffer, data: Buffer): void {
    const header = intLowHigh(data.length + 2, 2);
    this._raw(Buffer.concat([GS, Buffer.from('(L'), header, m, fn, data]));
  }

  // ── Line display ──────────────────────────────────────────────────────────

  /**
   * Open or close the line (customer) display.
   *
   * @param select - `true` to select the display (`ESC = 2`),
   *   `false` to return to the printer (`ESC = 1`).
   * @since 1.0.0
   */
  linedisplaySelect(select: boolean): void {
    this._raw(select ? LINE_DISPLAY_OPEN : LINE_DISPLAY_CLOSE);
  }

  /**
   * Clear the content of the line display (`ESC @`).
   *
   * @since 1.0.0
   */
  linedisplayClear(): void {
    this._raw(LINE_DISPLAY_CLEAR);
  }

  /**
   * Open the line display, clear it, write text, then close it.
   *
   * Convenience wrapper around {@link linedisplaySelect}, {@link linedisplayClear},
   * and {@link Escpos.text}.
   *
   * @param text - Text to display on the customer-facing line display.
   * @since 1.0.0
   */
  linedisplay(text: string): void {
    this.linedisplaySelect(true);
    this.linedisplayClear();
    this.text(text);
    this.linedisplaySelect(false);
  }
}

// ── Utility helpers (module-private) ─────────────────────────────────────────

function wordWrap(text: string, width: number): string {
  return text
    .split(' ')
    .reduce((lines: string[], word: string) => {
      const last = lines[lines.length - 1];
      return last.length + word.length + 1 <= width
        ? [...lines.slice(0, -1), last ? `${last} ${word}` : word]
        : [...lines, word];
    }, [''])
    .join('\n');
}

function wordWrapLines(text: string, width: number): string[] {
  return wordWrap(text, width).split('\n');
}

function padText(text: string, width: number, align: Alignment): string {
  if (align === 'center') {
    return text.padStart(Math.floor((width + text.length) / 2)).padEnd(width);
  }
  if (align === 'right') return text.padStart(width);
  if (align === 'justify') {
    // Simple fallback — full justify is complex, return padEnd
    return text.padEnd(width);
  }
  return text.padEnd(width);
}

function repeatLast<T>(arr: T[], n: number): T[] {
  return Array.from({ length: n }, (_, i) => arr[Math.min(i, arr.length - 1)]);
}
