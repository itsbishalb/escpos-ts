/**
 * @module escpos-ts/constants
 *
 * All ESC/POS byte-level constants, command buffers, and utility functions
 * used by the {@link Escpos} base class and its subclasses.
 *
 * Constants are grouped by function: control bytes, feed control, hardware
 * commands, cash drawer, paper cutter, text formatting, barcode commands,
 * QR code parameters, raster image commands, and real-time status commands.
 *
 * All `Buffer` values are pre-allocated at module load time and must be
 * treated as read-only — never mutate them in place.
 */

// ─── Control bytes ────────────────────────────────────────────────────────────
/** ASCII NUL (0x00) — terminates Function Type A barcode data. */
export const NUL  = Buffer.from([0x00]);
/** ASCII EOT (0x04) — End of Transmission; used in real-time status requests. */
export const EOT  = Buffer.from([0x04]);
/** ASCII ENQ (0x05) — used in some real-time status requests. */
export const ENQ  = Buffer.from([0x05]);
/** ASCII DLE (0x10) — Data Link Escape; prefix for real-time commands. */
export const DLE  = Buffer.from([0x10]);
/** ASCII DC4 (0x14). */
export const DC4  = Buffer.from([0x14]);
/** ASCII CAN (0x18) — Cancel. */
export const CAN  = Buffer.from([0x18]);
/** ESC byte (0x1B) — Escape; prefix for the majority of ESC/POS commands. */
export const ESC  = Buffer.from([0x1b]);
/** ASCII FS (0x1C) — File Separator; also used as `SLIP_SELECT`. */
export const FS   = Buffer.from([0x1c]);
/** GS byte (0x1D) — Group Separator; prefix for GS-class ESC/POS commands. */
export const GS   = Buffer.from([0x1d]);

// ─── Feed control ─────────────────────────────────────────────────────────────
/** Line Feed — advances paper one line. */
export const CTL_LF     = Buffer.from('\n');
/** Form Feed — used for page advancement on some printers. */
export const CTL_FF     = Buffer.from('\f');
/** Carriage Return. */
export const CTL_CR     = Buffer.from('\r');
/** Horizontal Tab. */
export const CTL_HT     = Buffer.from('\t');
/** `ESC D` — Set Horizontal Tab Positions. */
export const CTL_SET_HT = Buffer.concat([ESC, Buffer.from([0x44])]);
/** Vertical Tab. */
export const CTL_VT     = Buffer.from('\v');

// ─── Hardware ─────────────────────────────────────────────────────────────────
/** `ESC @` — Initialize printer; clears data in the print buffer. */
export const HW_INIT   = Buffer.concat([ESC, Buffer.from('@')]);
/** `ESC =` — Select peripheral device (printer selected). */
export const HW_SELECT = Buffer.concat([ESC, Buffer.from([0x3d, 0x01])]);
/** `ESC ?` — Transmit peripheral device ID; effectively a soft reset. */
export const HW_RESET  = Buffer.concat([ESC, Buffer.from([0x3f, 0x0a, 0x00])]);

// ─── Cash drawer ──────────────────────────────────────────────────────────────
function makeCashDrawer(pin: 0 | 1, t1 = 50, t2 = 50): Buffer {
  return Buffer.concat([ESC, Buffer.from('p'), Buffer.from([pin, t1, t2])]);
}
/** `ESC p 0 t1 t2` — Open cash drawer on pin 2 (50 ms on, 50 ms off). */
export const CD_KICK_2 = makeCashDrawer(0, 50, 50);
/** `ESC p 1 t1 t2` — Open cash drawer on pin 5 (50 ms on, 50 ms off). */
export const CD_KICK_5 = makeCashDrawer(1, 50, 50);

/**
 * Build a custom cash-drawer kick sequence from raw byte values.
 *
 * Allows sending a non-standard timing pulse when the default
 * {@link CD_KICK_2} / {@link CD_KICK_5} timings are insufficient.
 *
 * @param esc - ESC byte (0x1B).
 * @param p   - Pin selector byte (`0x70`).
 * @param m   - Pin number byte (0 = pin 2, 1 = pin 5).
 * @param t1  - On-time in units of 2 ms (default: 50 → 100 ms).
 * @param t2  - Off-time in units of 2 ms (default: 50 → 100 ms).
 * @returns Buffer containing the five-byte kick sequence.
 * @since 1.0.0
 */
export function cashDrawerDecSequence(esc: number, p: number, m: number, t1 = 50, t2 = 50): Buffer {
  return Buffer.from([esc, p, m, t1, t2]);
}

// ─── Paper cutter ─────────────────────────────────────────────────────────────
/** `GS V 0` — Full paper cut. */
export const PAPER_FULL_CUT = Buffer.concat([GS, Buffer.from([0x56, 0x00])]);
/** `GS V 1` — Partial paper cut (leaves a small uncut section). */
export const PAPER_PART_CUT = Buffer.concat([GS, Buffer.from([0x56, 0x01])]);

// ─── Beep / Buzzer ────────────────────────────────────────────────────────────
/** BEL byte (0x07) — triggers the buzzer on printers that support it. */
export const BEEP   = Buffer.from([0x07]);
/** `ESC B` — Buzzer control command (Epson-specific). */
export const BUZZER = Buffer.concat([ESC, Buffer.from([0x42])]);

// ─── Panel buttons ────────────────────────────────────────────────────────────
/** `ESC c5 0` — Enable panel buttons (feed, etc.) on the printer. */
export const PANEL_BUTTON_ON  = Buffer.concat([ESC, Buffer.from('c5'), Buffer.from([0])]);
/** `ESC c5 1` — Disable panel buttons. */
export const PANEL_BUTTON_OFF = Buffer.concat([ESC, Buffer.from('c5'), Buffer.from([1])]);

// ─── Line display ─────────────────────────────────────────────────────────────
/** `ESC = 2` — Select line display (customer display peripheral). */
export const LINE_DISPLAY_OPEN  = Buffer.concat([ESC, Buffer.from([0x3d, 0x02])]);
/** `ESC @` — Clear line display content. */
export const LINE_DISPLAY_CLEAR = Buffer.concat([ESC, Buffer.from([0x40])]);
/** `ESC = 1` — Deselect line display (return to printer). */
export const LINE_DISPLAY_CLOSE = Buffer.concat([ESC, Buffer.from([0x3d, 0x01])]);

// ─── Sheet modes ──────────────────────────────────────────────────────────────
/** `ESC c3 0 4` — Activate slip sheet mode. */
export const SHEET_SLIP_MODE = Buffer.concat([ESC, Buffer.from([0x63, 0x30, 0x04])]);
/** `ESC c3 0 1` — Activate roll paper mode (default). */
export const SHEET_ROLL_MODE = Buffer.concat([ESC, Buffer.from([0x63, 0x30, 0x01])]);
/** Eject the current slip sheet. */
export const SLIP_EJECT            = Buffer.concat([ESC, Buffer.from([0x4b, 0xc0])]);
/** Select slip sheet as the active printing surface (alias for {@link FS}). */
export const SLIP_SELECT           = FS;
/** Print and eject the current slip. */
export const SLIP_PRINT_AND_EJECT  = Buffer.from([0x0c]);

// ─── Text format ──────────────────────────────────────────────────────────────
/** `GS !` — Select character size (height × width multiplier). */
export const TXT_SIZE   = Buffer.concat([GS, Buffer.from('!')]);
/** `ESC ! 0` — Cancel all text styles (normal size, no bold/underline). */
export const TXT_NORMAL = Buffer.concat([ESC, Buffer.from([0x21, 0x00])]);

/**
 * Pre-built ESC/POS style command buffers.
 *
 * Each sub-map contains pre-allocated `Buffer` values for common style
 * attributes.  Pass the appropriate buffer directly to `_raw()` to apply
 * the style.
 *
 * @example
 * ```ts
 * this._raw(TXT_STYLE.bold.true);   // Enable bold
 * this._raw(TXT_STYLE.align.center); // Center align
 * this._raw(TXT_STYLE.bold.false);  // Disable bold
 * ```
 */
export const TXT_STYLE = {
  bold: {
    false: Buffer.concat([ESC, Buffer.from([0x45, 0x00])]),
    true:  Buffer.concat([ESC, Buffer.from([0x45, 0x01])]),
  },
  underline: {
    0: Buffer.concat([ESC, Buffer.from([0x2d, 0x00])]),
    1: Buffer.concat([ESC, Buffer.from([0x2d, 0x01])]),
    2: Buffer.concat([ESC, Buffer.from([0x2d, 0x02])]),
  },
  size: {
    normal: Buffer.concat([TXT_NORMAL, ESC, Buffer.from([0x21, 0x00])]),
    '2h':   Buffer.concat([TXT_NORMAL, ESC, Buffer.from([0x21, 0x10])]),
    '2w':   Buffer.concat([TXT_NORMAL, ESC, Buffer.from([0x21, 0x20])]),
    '2x':   Buffer.concat([TXT_NORMAL, ESC, Buffer.from([0x21, 0x30])]),
  },
  font: {
    a: Buffer.concat([ESC, Buffer.from([0x4d, 0x00])]),
    b: Buffer.concat([ESC, Buffer.from([0x4d, 0x01])]),
  },
  align: {
    left:   Buffer.concat([ESC, Buffer.from([0x61, 0x00])]),
    center: Buffer.concat([ESC, Buffer.from([0x61, 0x01])]),
    right:  Buffer.concat([ESC, Buffer.from([0x61, 0x02])]),
  },
  invert: {
    true:  Buffer.concat([GS, Buffer.from([0x42, 0x01])]),
    false: Buffer.concat([GS, Buffer.from([0x42, 0x00])]),
  },
  color: {
    black: Buffer.concat([ESC, Buffer.from([0x72, 0x00])]),
    red:   Buffer.concat([ESC, Buffer.from([0x72, 0x01])]),
  },
  flip: {
    true:  Buffer.concat([ESC, Buffer.from([0x7b, 0x01])]),
    false: Buffer.concat([ESC, Buffer.from([0x7b, 0x00])]),
  },
  density: {
    0: Buffer.concat([GS, Buffer.from([0x7c, 0x00])]),
    1: Buffer.concat([GS, Buffer.from([0x7c, 0x01])]),
    2: Buffer.concat([GS, Buffer.from([0x7c, 0x02])]),
    3: Buffer.concat([GS, Buffer.from([0x7c, 0x03])]),
    4: Buffer.concat([GS, Buffer.from([0x7c, 0x04])]),
    5: Buffer.concat([GS, Buffer.from([0x7c, 0x08])]),
    6: Buffer.concat([GS, Buffer.from([0x7c, 0x07])]),
    7: Buffer.concat([GS, Buffer.from([0x7c, 0x06])]),
    8: Buffer.concat([GS, Buffer.from([0x7c, 0x05])]),
  },
  smooth: {
    true:  Buffer.concat([GS, Buffer.from([0x62, 0x01])]),
    false: Buffer.concat([GS, Buffer.from([0x62, 0x00])]),
  },
  height: { 1:0x00, 2:0x01, 3:0x02, 4:0x03, 5:0x04, 6:0x05, 7:0x06, 8:0x07 } as Record<number, number>,
  width:  { 1:0x00, 2:0x10, 3:0x20, 4:0x30, 5:0x40, 6:0x50, 7:0x60, 8:0x70 } as Record<number, number>,
} as const;

// ─── Fonts ────────────────────────────────────────────────────────────────────
/**
 * Build an `ESC M n` — Select Font command buffer.
 *
 * @param n - Single-byte Buffer containing the font index (0x00 = Font A, 0x01 = Font B).
 * @returns Buffer with the complete `ESC M n` sequence.
 * @since 1.0.0
 */
export function setFont(n: Buffer): Buffer {
  return Buffer.concat([ESC, Buffer.from([0x4d]), n]);
}
/** `ESC M 0` — Select Font A (default). */
export const TXT_FONT_A = setFont(Buffer.from([0x00]));
/** `ESC M 1` — Select Font B (condensed). */
export const TXT_FONT_B = setFont(Buffer.from([0x01]));

// ─── Line spacing ─────────────────────────────────────────────────────────────
/** `ESC 2` — Reset line spacing to the printer's default. */
export const LINESPACING_RESET = Buffer.concat([ESC, Buffer.from('2')]);
/**
 * Map of divisor value to ESC/POS line-spacing command buffer.
 *
 * | Key | Command | Unit |
 * |-----|---------|------|
 * | 60  | `ESC A` | 1/60 inch per dot |
 * | 180 | `ESC 3` | 1/180 inch per dot |
 * | 360 | `ESC +` | 1/360 inch per dot |
 */
export const LINESPACING_FUNCS: Record<number, Buffer> = {
  60:  Buffer.concat([ESC, Buffer.from('A')]),
  360: Buffer.concat([ESC, Buffer.from('+')]),
  180: Buffer.concat([ESC, Buffer.from('3')]),
};

// ─── Code page ────────────────────────────────────────────────────────────────
/** `ESC t n` — Select character code table (code page).  Append the code-page index byte. */
export const CODEPAGE_CHANGE = Buffer.concat([ESC, Buffer.from([0x74])]);

// ─── Barcode ──────────────────────────────────────────────────────────────────
/** `GS H 0` — Do not print human-readable interpretation below/above barcode. */
export const BARCODE_TXT_OFF = Buffer.concat([GS, Buffer.from([0x48, 0x00])]);
/** `GS H 1` — Print human-readable interpretation above the barcode. */
export const BARCODE_TXT_ABV = Buffer.concat([GS, Buffer.from([0x48, 0x01])]);
/** `GS H 2` — Print human-readable interpretation below the barcode. */
export const BARCODE_TXT_BLW = Buffer.concat([GS, Buffer.from([0x48, 0x02])]);
/** `GS H 3` — Print human-readable interpretation both above and below. */
export const BARCODE_TXT_BTH = Buffer.concat([GS, Buffer.from([0x48, 0x03])]);
/** `GS f 0` — Select Font A for the human-readable barcode text. */
export const BARCODE_FONT_A  = Buffer.concat([GS, Buffer.from([0x66, 0x00])]);
/** `GS f 1` — Select Font B for the human-readable barcode text. */
export const BARCODE_FONT_B  = Buffer.concat([GS, Buffer.from([0x66, 0x01])]);
/** `GS h n` — Set barcode height command prefix (append height byte 1–255). */
export const BARCODE_HEIGHT  = Buffer.concat([GS, Buffer.from([0x68])]);
/** `GS w n` — Set barcode width (module width) command prefix (append width byte 2–6). */
export const BARCODE_WIDTH   = Buffer.concat([GS, Buffer.from([0x77])]);

function setBarcodeType(m: number): Buffer {
  return Buffer.concat([GS, Buffer.from('k'), Buffer.from([m])]);
}

/**
 * Function Type A barcode command buffers.
 *
 * Type A uses `GS k m` followed by the barcode data and a NUL terminator.
 * Supports the eight barcode types defined in the original ESC/POS specification.
 */
export const BARCODE_TYPE_A: Record<string, Buffer> = {
  'UPC-A':   setBarcodeType(0),
  'UPC-E':   setBarcodeType(1),
  'EAN13':   setBarcodeType(2),
  'EAN8':    setBarcodeType(3),
  'CODE39':  setBarcodeType(4),
  'ITF':     setBarcodeType(5),
  'NW7':     setBarcodeType(6),
  'CODABAR': setBarcodeType(6),
};

/**
 * Function Type B barcode command buffers.
 *
 * Type B uses `GS k m n` where `n` is the data length, supporting a wider
 * range of barcode standards including CODE128, CODE93, and GS1 variants.
 */
export const BARCODE_TYPE_B: Record<string, Buffer> = {
  'UPC-A':                        setBarcodeType(65),
  'UPC-E':                        setBarcodeType(66),
  'EAN13':                        setBarcodeType(67),
  'EAN8':                         setBarcodeType(68),
  'CODE39':                       setBarcodeType(69),
  'ITF':                          setBarcodeType(70),
  'NW7':                          setBarcodeType(71),
  'CODABAR':                      setBarcodeType(71),
  'CODE93':                       setBarcodeType(72),
  'CODE128':                      setBarcodeType(73),
  'GS1-128':                      setBarcodeType(74),
  'GS1 DATABAR OMNIDIRECTIONAL':  setBarcodeType(75),
  'GS1 DATABAR TRUNCATED':        setBarcodeType(76),
  'GS1 DATABAR LIMITED':          setBarcodeType(77),
  'GS1 DATABAR EXPANDED':         setBarcodeType(78),
};

/**
 * Unified barcode type registry — `{ 'A': BARCODE_TYPE_A, 'B': BARCODE_TYPE_B }`.
 *
 * Used by {@link Escpos.barcode} to look up the correct command buffer for a
 * given barcode name and function type.
 */
export const BARCODE_TYPES: Record<string, Record<string, Buffer>> = {
  A: BARCODE_TYPE_A,
  B: BARCODE_TYPE_B,
};

/**
 * Barcode format validation rules.
 *
 * Each entry maps a barcode name to a tuple of:
 *   - Valid code length ranges: `[min, max][]`
 *   - A `RegExp` the code string must match.
 *
 * Used by {@link Escpos.checkBarcode} to validate input before sending to
 * the printer.
 */
export const BARCODE_FORMATS: Record<string, [[number, number][], RegExp]> = {
  'UPC-A':   [[[11, 12]], /^[0-9]{11,12}$/],
  'UPC-E':   [[[7, 8], [11, 12]], /^([0-9]{7,8}|[0-9]{11,12})$/],
  'EAN13':   [[[12, 13]], /^[0-9]{12,13}$/],
  'EAN8':    [[[7, 8]], /^[0-9]{7,8}$/],
  'CODE39':  [[[1, 255]], /^([0-9A-Z $%+\-.\/]+|\*[0-9A-Z $%+\-.\/]+\*)$/],
  'ITF':     [[[2, 255]], /^([0-9]{2})+$/],
  'NW7':     [[[1, 255]], /^[A-Da-d][0-9$+\-.\/:]+ [A-Da-d]$/],
  'CODABAR': [[[1, 255]], /^[A-Da-d][0-9$+\-.\/:]+ [A-Da-d]$/],
  'CODE93':  [[[1, 255]], /^[\x00-\x7F]+$/],
  'CODE128': [[[2, 255]], /^\{[A-C][\x00-\x7F]+$/],
  'GS1-128': [[[2, 255]], /^\{[A-C][\x00-\x7F]+$/],
  'GS1 DATABAR OMNIDIRECTIONAL': [[[13, 13]], /^[0-9]{13}$/],
  'GS1 DATABAR TRUNCATED':       [[[13, 13]], /^[0-9]{13}$/],
  'GS1 DATABAR LIMITED':         [[[13, 13]], /^[01][0-9]{12}$/],
  'GS1 DATABAR EXPANDED':        [[[2, 255]], /^\([0-9][A-Za-z0-9 !"&'()*+,\-./:;<=>?_{]+$/],
};

// ─── QR Code ──────────────────────────────────────────────────────────────────
/** Error correction level L — approximately 7% data restoration. */
export const QR_ECLEVEL_L = 0;
/** Error correction level M — approximately 15% data restoration. */
export const QR_ECLEVEL_M = 1;
/** Error correction level Q — approximately 25% data restoration. */
export const QR_ECLEVEL_Q = 2;
/** Error correction level H — approximately 30% data restoration. */
export const QR_ECLEVEL_H = 3;
/** QR Model 1 — original QR code standard. */
export const QR_MODEL_1   = 1;
/** QR Model 2 — improved QR standard; most widely supported (recommended). */
export const QR_MODEL_2   = 2;
/** Micro QR Code — compact variant for small data payloads. */
export const QR_MICRO     = 3;

// ─── Raster image ─────────────────────────────────────────────────────────────
function printRasterImg(mode: number): Buffer {
  return Buffer.concat([GS, Buffer.from('v0'), Buffer.from([mode])]);
}
/** `GS v 0 0` — Print raster bit image at normal density. */
export const S_RASTER_N  = printRasterImg(0x00);
/** `GS v 0 1` — Print raster bit image at double-width density. */
export const S_RASTER_2W = printRasterImg(0x01);
/** `GS v 0 2` — Print raster bit image at double-height density. */
export const S_RASTER_2H = printRasterImg(0x02);
/** `GS v 0 3` — Print raster bit image at quadruple density. */
export const S_RASTER_Q  = printRasterImg(0x03);

// ─── Status ───────────────────────────────────────────────────────────────────
/** `DLE EOT` — Real-time status request command prefix. */
export const RT_STATUS        = Buffer.concat([DLE, EOT]);
/** `DLE EOT 1` — Request printer online status. */
export const RT_STATUS_ONLINE = Buffer.concat([RT_STATUS, Buffer.from([0x01])]);
/** `DLE EOT 4` — Request paper sensor status. */
export const RT_STATUS_PAPER  = Buffer.concat([RT_STATUS, Buffer.from([0x04])]);
/** Bitmask for the "online" bit in an online-status response byte. */
export const RT_MASK_ONLINE   = 8;
/** Bitmask for "paper present" in a paper-status response byte. */
export const RT_MASK_PAPER    = 18;
/** Bitmask for "paper low" in a paper-status response byte. */
export const RT_MASK_LOWPAPER = 30;
/** Bitmask for "paper out" in a paper-status response byte. */
export const RT_MASK_NOPAPER  = 114;

// ─── Utility ──────────────────────────────────────────────────────────────────
/**
 * Encode an unsigned integer as a little-endian byte sequence.
 *
 * Used extensively in ESC/POS command construction wherever a multi-byte
 * length or value field is required (e.g. `GS ( k` payload length).
 * Equivalent to the python-escpos `_int_low_high` helper.
 *
 * @param value     - Non-negative integer to encode.
 * @param byteCount - Number of bytes to produce (1, 2, 3, or 4).
 * @returns Little-endian Buffer of `byteCount` bytes.
 *
 * @example
 * ```ts
 * intLowHigh(512, 2); // → Buffer<[0x00, 0x02]>
 * intLowHigh(7,   2); // → Buffer<[0x07, 0x00]>
 * ```
 *
 * @since 1.0.0
 */
export function intLowHigh(value: number, byteCount: 1 | 2 | 3 | 4): Buffer {
  const buf = Buffer.alloc(byteCount);
  let v = value;
  for (let i = 0; i < byteCount; i++) {
    buf[i] = v & 0xff;
    v >>= 8;
  }
  return buf;
}
