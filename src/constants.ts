// src/constants.ts

// ─── Control bytes ────────────────────────────────────────────────────────────
export const NUL  = Buffer.from([0x00]);
export const EOT  = Buffer.from([0x04]);
export const ENQ  = Buffer.from([0x05]);
export const DLE  = Buffer.from([0x10]);
export const DC4  = Buffer.from([0x14]);
export const CAN  = Buffer.from([0x18]);
export const ESC  = Buffer.from([0x1b]);
export const FS   = Buffer.from([0x1c]);
export const GS   = Buffer.from([0x1d]);

// ─── Feed control ─────────────────────────────────────────────────────────────
export const CTL_LF     = Buffer.from('\n');
export const CTL_FF     = Buffer.from('\f');
export const CTL_CR     = Buffer.from('\r');
export const CTL_HT     = Buffer.from('\t');
export const CTL_SET_HT = Buffer.concat([ESC, Buffer.from([0x44])]);
export const CTL_VT     = Buffer.from('\v');

// ─── Hardware ─────────────────────────────────────────────────────────────────
export const HW_INIT   = Buffer.concat([ESC, Buffer.from('@')]);
export const HW_SELECT = Buffer.concat([ESC, Buffer.from([0x3d, 0x01])]);
export const HW_RESET  = Buffer.concat([ESC, Buffer.from([0x3f, 0x0a, 0x00])]);

// ─── Cash drawer ──────────────────────────────────────────────────────────────
function makeCashDrawer(pin: 0 | 1, t1 = 50, t2 = 50): Buffer {
  return Buffer.concat([ESC, Buffer.from('p'), Buffer.from([pin, t1, t2])]);
}
export const CD_KICK_2 = makeCashDrawer(0, 50, 50);
export const CD_KICK_5 = makeCashDrawer(1, 50, 50);

/** Build a decimal cash-drawer kick sequence from raw bytes. */
export function cashDrawerDecSequence(esc: number, p: number, m: number, t1 = 50, t2 = 50): Buffer {
  return Buffer.from([esc, p, m, t1, t2]);
}

// ─── Paper cutter ─────────────────────────────────────────────────────────────
export const PAPER_FULL_CUT = Buffer.concat([GS, Buffer.from([0x56, 0x00])]);
export const PAPER_PART_CUT = Buffer.concat([GS, Buffer.from([0x56, 0x01])]);

// ─── Beep / Buzzer ────────────────────────────────────────────────────────────
export const BEEP   = Buffer.from([0x07]);
export const BUZZER = Buffer.concat([ESC, Buffer.from([0x42])]);

// ─── Panel buttons ────────────────────────────────────────────────────────────
export const PANEL_BUTTON_ON  = Buffer.concat([ESC, Buffer.from('c5'), Buffer.from([0])]);
export const PANEL_BUTTON_OFF = Buffer.concat([ESC, Buffer.from('c5'), Buffer.from([1])]);

// ─── Line display ─────────────────────────────────────────────────────────────
export const LINE_DISPLAY_OPEN  = Buffer.concat([ESC, Buffer.from([0x3d, 0x02])]);
export const LINE_DISPLAY_CLEAR = Buffer.concat([ESC, Buffer.from([0x40])]);
export const LINE_DISPLAY_CLOSE = Buffer.concat([ESC, Buffer.from([0x3d, 0x01])]);

// ─── Sheet modes ──────────────────────────────────────────────────────────────
export const SHEET_SLIP_MODE = Buffer.concat([ESC, Buffer.from([0x63, 0x30, 0x04])]);
export const SHEET_ROLL_MODE = Buffer.concat([ESC, Buffer.from([0x63, 0x30, 0x01])]);
export const SLIP_EJECT            = Buffer.concat([ESC, Buffer.from([0x4b, 0xc0])]);
export const SLIP_SELECT           = FS;
export const SLIP_PRINT_AND_EJECT  = Buffer.from([0x0c]);

// ─── Text format ──────────────────────────────────────────────────────────────
export const TXT_SIZE   = Buffer.concat([GS, Buffer.from('!')]);
export const TXT_NORMAL = Buffer.concat([ESC, Buffer.from([0x21, 0x00])]);

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
export function setFont(n: Buffer): Buffer {
  return Buffer.concat([ESC, Buffer.from([0x4d]), n]);
}
export const TXT_FONT_A = setFont(Buffer.from([0x00]));
export const TXT_FONT_B = setFont(Buffer.from([0x01]));

// ─── Line spacing ─────────────────────────────────────────────────────────────
export const LINESPACING_RESET = Buffer.concat([ESC, Buffer.from('2')]);
export const LINESPACING_FUNCS: Record<number, Buffer> = {
  60:  Buffer.concat([ESC, Buffer.from('A')]),
  360: Buffer.concat([ESC, Buffer.from('+')]),
  180: Buffer.concat([ESC, Buffer.from('3')]),
};

// ─── Code page ────────────────────────────────────────────────────────────────
export const CODEPAGE_CHANGE = Buffer.concat([ESC, Buffer.from([0x74])]);

// ─── Barcode ──────────────────────────────────────────────────────────────────
export const BARCODE_TXT_OFF = Buffer.concat([GS, Buffer.from([0x48, 0x00])]);
export const BARCODE_TXT_ABV = Buffer.concat([GS, Buffer.from([0x48, 0x01])]);
export const BARCODE_TXT_BLW = Buffer.concat([GS, Buffer.from([0x48, 0x02])]);
export const BARCODE_TXT_BTH = Buffer.concat([GS, Buffer.from([0x48, 0x03])]);
export const BARCODE_FONT_A  = Buffer.concat([GS, Buffer.from([0x66, 0x00])]);
export const BARCODE_FONT_B  = Buffer.concat([GS, Buffer.from([0x66, 0x01])]);
export const BARCODE_HEIGHT  = Buffer.concat([GS, Buffer.from([0x68])]);
export const BARCODE_WIDTH   = Buffer.concat([GS, Buffer.from([0x77])]);

function setBarcodeType(m: number): Buffer {
  return Buffer.concat([GS, Buffer.from('k'), Buffer.from([m])]);
}

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

export const BARCODE_TYPES: Record<string, Record<string, Buffer>> = {
  A: BARCODE_TYPE_A,
  B: BARCODE_TYPE_B,
};

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
export const QR_ECLEVEL_L = 0;
export const QR_ECLEVEL_M = 1;
export const QR_ECLEVEL_Q = 2;
export const QR_ECLEVEL_H = 3;
export const QR_MODEL_1   = 1;
export const QR_MODEL_2   = 2;
export const QR_MICRO     = 3;

// ─── Raster image ─────────────────────────────────────────────────────────────
function printRasterImg(mode: number): Buffer {
  return Buffer.concat([GS, Buffer.from('v0'), Buffer.from([mode])]);
}
export const S_RASTER_N  = printRasterImg(0x00);
export const S_RASTER_2W = printRasterImg(0x01);
export const S_RASTER_2H = printRasterImg(0x02);
export const S_RASTER_Q  = printRasterImg(0x03);

// ─── Status ───────────────────────────────────────────────────────────────────
export const RT_STATUS        = Buffer.concat([DLE, EOT]);
export const RT_STATUS_ONLINE = Buffer.concat([RT_STATUS, Buffer.from([0x01])]);
export const RT_STATUS_PAPER  = Buffer.concat([RT_STATUS, Buffer.from([0x04])]);
export const RT_MASK_ONLINE   = 8;
export const RT_MASK_PAPER    = 18;
export const RT_MASK_LOWPAPER = 30;
export const RT_MASK_NOPAPER  = 114;

// ─── Utility ──────────────────────────────────────────────────────────────────
/**
 * Encode a number as little-endian bytes.
 * Equivalent to Python's `_int_low_high`.
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
