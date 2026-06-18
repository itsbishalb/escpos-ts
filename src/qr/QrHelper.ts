/**
 * @file QrHelper.ts
 * @description Builds ESC/POS native QR code byte sequences using the GS ( k
 * command set.  All five required sub-commands (set model, set size, set error
 * correction level, store data, print) are concatenated into a single Buffer
 * that can be written directly to the printer via `_raw()`.
 *
 * References:
 *   - Epson ESC/POS Application Programming Guide (Rev. 1.01)
 *   - python-escpos `escpos.py` `_check_qr` / `qr()` implementation
 */

import {
  QR_ECLEVEL_L, QR_ECLEVEL_M, QR_ECLEVEL_Q, QR_ECLEVEL_H,
  QR_MODEL_1, QR_MODEL_2, QR_MICRO,
  intLowHigh,
} from '../constants';

/**
 * Options controlling the QR code appearance and encoding.
 */
export interface QrOptions {
  /**
   * QR model constant.  Use the `QR_MODEL_*` constants from `../constants`.
   *   - `QR_MODEL_1` = 1
   *   - `QR_MODEL_2` = 2 (default; most widely supported)
   *   - `QR_MICRO`   = 3
   */
  model?: number;

  /**
   * Module size (pixel width per cell), 1–16.  Defaults to 3.
   */
  size?: number;

  /**
   * Error correction level.  Use the `QR_ECLEVEL_*` constants from
   * `../constants`.
   *   - `QR_ECLEVEL_L` = 0 — roughly 7 % correction (default)
   *   - `QR_ECLEVEL_M` = 1 — roughly 15 % correction
   *   - `QR_ECLEVEL_Q` = 2 — roughly 25 % correction
   *   - `QR_ECLEVEL_H` = 3 — roughly 30 % correction
   */
  eclevel?: number;
}

// ─── Internal helpers ──────────────────────────────────────────────────────────

/**
 * GS ( k header bytes shared by all QR sub-commands.
 *
 *   GS  = 0x1D
 *   (   = 0x28
 *   k   = 0x6B
 */
const GS_LPAREN_K = Buffer.from([0x1d, 0x28, 0x6b]);

/**
 * cn byte for QR code function (always 0x31 = ASCII '1').
 */
const CN_QR = Buffer.from([0x31]);

/**
 * Build a single `GS ( k` sub-command packet.
 *
 * Packet layout:
 * ```
 *   GS ( k  pL pH  cn  fn  [m]  data
 * ```
 * where pL/pH encodes `(m.length + data.length + 2)` as a little-endian
 * 16-bit value (the `+ 2` accounts for the `cn` and `fn` bytes).
 *
 * @param fn   - Function byte (one byte, e.g. 0x41 for "set model").
 * @param data - Payload bytes that follow cn and fn.
 * @param m    - Optional leading byte(s) inserted before `data` (used by
 *               store-data and print commands where ESC/POS inserts an
 *               extra `m` byte = 0x30).
 */
function buildQrPacket(fn: number, data: Buffer, m: Buffer = Buffer.alloc(0)): Buffer {
  const payloadLen = m.length + data.length + 2; // +2 for cn + fn
  const lenBytes = intLowHigh(payloadLen, 2);
  return Buffer.concat([GS_LPAREN_K, lenBytes, CN_QR, Buffer.from([fn]), m, data]);
}

// ─── Valid value sets ──────────────────────────────────────────────────────────

const VALID_MODELS  = new Set([QR_MODEL_1, QR_MODEL_2, QR_MICRO]);
const VALID_ECLEVELS = new Set([QR_ECLEVEL_L, QR_ECLEVEL_M, QR_ECLEVEL_Q, QR_ECLEVEL_H]);

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Helper that constructs the complete ESC/POS byte sequence for a native
 * (printer-side) QR code.  The returned `Buffer` must be written to the
 * printer verbatim — no further transformation is needed.
 *
 * The sequence consists of five sub-commands in order:
 *  1. Set QR model          (fn = 0x41)
 *  2. Set module size       (fn = 0x43)
 *  3. Set error correction  (fn = 0x45)
 *  4. Store data            (fn = 0x50)
 *  5. Print stored symbol   (fn = 0x51)
 *
 * @example
 * ```ts
 * import { QrHelper, QrOptions } from './qr/QrHelper';
 * import { QR_ECLEVEL_M, QR_MODEL_2 } from './constants';
 *
 * const bytes = QrHelper.generate('https://example.com', {
 *   model: QR_MODEL_2,
 *   size:  4,
 *   eclevel: QR_ECLEVEL_M,
 * });
 * printer._raw(bytes);
 * ```
 */
export class QrHelper {
  /**
   * Generate the full ESC/POS QR code byte sequence for the given text.
   *
   * @param text    - The string to encode.  Encoded as UTF-8.
   * @param options - Optional QR parameters (model, size, error correction).
   * @returns A `Buffer` containing the concatenated ESC/POS commands.
   *
   * @throws {RangeError} If `text` is empty.
   * @throws {RangeError} If `size` is outside the 1–16 range.
   * @throws {RangeError} If `model` or `eclevel` is not a recognised constant.
   */
  static generate(text: string, options: QrOptions = {}): Buffer {
    const {
      model   = QR_MODEL_2,
      size    = 3,
      eclevel = QR_ECLEVEL_L,
    } = options;

    if (!text) throw new RangeError('QrHelper.generate: text must not be empty');
    if (size < 1 || size > 16) throw new RangeError(`QrHelper.generate: size must be 1-16, got ${size}`);
    if (!VALID_MODELS.has(model)) throw new RangeError(`QrHelper.generate: invalid model ${model}`);
    if (!VALID_ECLEVELS.has(eclevel)) throw new RangeError(`QrHelper.generate: invalid eclevel ${eclevel}`);

    // ── 1. Set model (fn = 0x41) ─────────────────────────────────────────────
    // Payload: model_byte  0x00
    // The printer model byte is (model + 48) per the spec, but the spec
    // actually uses the raw integer value 49/50/51 for model 1/2/micro.
    // The constant QR_MODEL_1=1, QR_MODEL_2=2, QR_MICRO=3.
    // Per the ESC/POS spec the byte sent is (48 + model), i.e. ASCII '1','2','3'.
    const setModel = buildQrPacket(0x41, Buffer.from([48 + model, 0x00]));

    // ── 2. Set module size (fn = 0x43) ───────────────────────────────────────
    // Payload: size byte (1-16)
    const setSize = buildQrPacket(0x43, Buffer.from([size]));

    // ── 3. Set error correction level (fn = 0x45) ────────────────────────────
    // Payload: ec byte.  The spec sends (48 + eclevel): 48=L, 49=M, 50=Q, 51=H
    const setEc = buildQrPacket(0x45, Buffer.from([48 + eclevel]));

    // ── 4. Store data in symbol storage area (fn = 0x50) ─────────────────────
    // Extra leading byte 'm' = 0x30 is required per the spec.
    // The payload length includes m + data + 2 (cn + fn).
    const textBytes = Buffer.from(text, 'utf8');
    const storeData = buildQrPacket(0x50, textBytes, Buffer.from([0x30]));

    // ── 5. Print symbol (fn = 0x51) ──────────────────────────────────────────
    // Extra leading byte 'm' = 0x30 is required per the spec.
    const printSymbol = buildQrPacket(0x51, Buffer.alloc(0), Buffer.from([0x30]));

    return Buffer.concat([setModel, setSize, setEc, storeData, printSymbol]);
  }
}
