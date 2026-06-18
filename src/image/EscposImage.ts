/**
 * @module image/EscposImage
 * @description Converts image files or Buffers to ESC/POS raster and column
 * bit-image data ready to send to a thermal printer.
 *
 * ESC/POS raster format reference:
 *   GS v 0  m  xL xH  yL yH  <data...>
 *   1D 76 30 m  xL xH  yL yH  <data...>
 *
 * Pixel encoding:
 *   - Row-major, MSB-first packed bits.
 *   - Dark pixel (luminance < 128) → bit 1.
 *   - bytesPerRow = ceil(width / 8); last byte of each row is zero-padded.
 *
 * ## Design note — avoiding `file-type` dependency
 *
 * jimp v1 uses the `file-type` ESM-only package internally for buffer-type
 * detection.  `file-type` cannot be loaded in Jest's CommonJS sandbox without
 * `--experimental-vm-modules`.  To keep the test suite simple and dependency-
 * free we implement our own magic-byte MIME detection and invoke the jimp
 * format decoders directly, bypassing `Jimp.read()` / `Jimp.fromBuffer()`.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Jimp, type JimpInstance } from 'jimp';

// ── Type helpers ─────────────────────────────────────────────────────────────

/** Bare minimum of what each jimp format exposes for our usage. */
interface DecoderFormat {
  mime: string;
  decode: (buf: Buffer) => unknown;
  encode?: unknown; // optional — we only use decode
}

/** Jimp instance cast type that exposes the formats array. */
interface JimpWithFormats {
  formats: DecoderFormat[];
}

// ── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Detect the MIME type of an image buffer from its magic bytes.
 *
 * Supports the formats bundled in jimp's default configuration:
 * PNG, JPEG, BMP (and MS-BMP), GIF, TIFF.
 *
 * @returns MIME type string, or `undefined` when the format is unrecognised.
 */
function detectMimeFromMagic(buf: Buffer): string | undefined {
  if (buf.length < 4) return undefined;
  // PNG: 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)
    return 'image/png';
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
    return 'image/jpeg';
  // BMP / MS-BMP: 42 4D
  if (buf[0] === 0x42 && buf[1] === 0x4d)
    return 'image/bmp';
  // GIF: 47 49 46 38
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38)
    return 'image/gif';
  // TIFF LE: 49 49 2A 00 | TIFF BE: 4D 4D 00 2A
  if (
    (buf[0] === 0x49 && buf[1] === 0x49 && buf[2] === 0x2a && buf[3] === 0x00) ||
    (buf[0] === 0x4d && buf[1] === 0x4d && buf[2] === 0x00 && buf[3] === 0x2a)
  )
    return 'image/tiff';
  return undefined;
}

/** Map a file extension (lower-case, including the dot) to a MIME type. */
const EXT_TO_MIME: Record<string, string> = {
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.bmp':  'image/bmp',
  '.gif':  'image/gif',
  '.tif':  'image/tiff',
  '.tiff': 'image/tiff',
};

/**
 * Read an image file and return its raw bytes plus detected MIME type.
 *
 * For file paths the MIME is inferred from the extension (fallback: magic
 * bytes).  For Buffers the MIME is detected purely from magic bytes.
 *
 * @throws `Error` if the MIME type cannot be determined.
 */
async function loadBuffer(source: string | Buffer): Promise<{ buf: Buffer; mime: string }> {
  let buf: Buffer;

  if (typeof source === 'string') {
    buf = await fs.promises.readFile(source);
    const ext = path.extname(source).toLowerCase();
    const mime = EXT_TO_MIME[ext] ?? detectMimeFromMagic(buf);
    if (!mime) throw new Error(`Cannot determine image type for path: ${source}`);
    return { buf, mime };
  }

  buf = source;
  const mime = detectMimeFromMagic(buf);
  if (!mime) throw new Error('Cannot determine image type from Buffer magic bytes');
  return { buf, mime };
}

/**
 * Decode an image buffer to a Jimp instance, using the registered format
 * decoder that matches `mime`.  This path never calls `Jimp.read()` or
 * `Jimp.fromBuffer()`, so it does not depend on the `file-type` ESM package.
 *
 * @throws `Error` if jimp has no registered decoder for `mime`.
 */
function decodeWithJimp(buf: Buffer, mime: string): JimpInstance {
  // We need a Jimp instance only to access the `.formats` array — the
  // instance itself is discarded immediately.
  const probe = (new Jimp({ width: 1, height: 1, color: 0 })) as unknown as JimpWithFormats;
  // BMP can be registered as either 'image/bmp' or 'image/x-ms-bmp'
  const mimeAlt = mime === 'image/bmp' ? 'image/x-ms-bmp' : mime;
  const format = probe.formats.find(f => f.mime === mime || f.mime === mimeAlt);
  if (!format?.decode) {
    throw new Error(`No jimp decoder registered for MIME type: ${mime}`);
  }
  const bitmap = format.decode(buf);
  return Jimp.fromBitmap(bitmap as Parameters<typeof Jimp.fromBitmap>[0]) as JimpInstance;
}

// ── EscposImage ───────────────────────────────────────────────────────────────

/**
 * An image loaded from a file path or raw Buffer, pre-processed into a
 * two-dimensional boolean pixel grid ready for ESC/POS encoding.
 *
 * Dark pixel  → `true`
 * Light pixel → `false`
 */
export class EscposImage {
  /** Image width in pixels. */
  readonly width: number;

  /** Image height in pixels (number of rows). */
  readonly height: number;

  /**
   * Number of bytes required to represent one row of pixels.
   * Equals `Math.ceil(width / 8)`.
   */
  readonly widthBytes: number;

  /** `pixels[row][col]` — `true` means dark (print dot). */
  private readonly pixels: boolean[][];

  private constructor(pixels: boolean[][], width: number, height: number) {
    this.pixels = pixels;
    this.width = width;
    this.height = height;
    this.widthBytes = Math.ceil(width / 8);
  }

  // ── Factory ──────────────────────────────────────────────────────────────

  /**
   * Load an image from a file path or raw image Buffer (PNG, BMP, JPEG, GIF,
   * TIFF).
   *
   * The image is:
   *   1. Composited onto a white background to flatten any alpha channel.
   *   2. Converted to greyscale.
   *   3. Thresholded at luminance 128 — any pixel darker than 128 is treated
   *      as a printed dot.
   *
   * @param source - Absolute file path or raw image file Buffer.
   * @returns A resolved `EscposImage` instance.
   */
  static async load(source: string | Buffer): Promise<EscposImage> {
    const { buf, mime } = await loadBuffer(source);
    const jimg = decodeWithJimp(buf, mime) as JimpInstance;

    // Flatten transparency: composite the loaded image over a white background.
    const bg = new Jimp({ width: jimg.width, height: jimg.height, color: 0xffffffff });
    bg.composite(jimg, 0, 0);
    bg.greyscale();

    const { width, height, data } = bg.bitmap;

    // Build the boolean pixel grid from the raw RGBA bitmap.
    // Each pixel occupies 4 bytes: R G B A (all channels equal after greyscale).
    const pixels: boolean[][] = [];
    for (let y = 0; y < height; y++) {
      pixels[y] = new Array<boolean>(width);
      for (let x = 0; x < width; x++) {
        const offset = (y * width + x) * 4;
        const r = data[offset]; // greyscale value (0 = black, 255 = white)
        pixels[y][x] = r < 128; // dark pixel → true → print dot
      }
    }

    return new EscposImage(pixels, width, height);
  }

  // ── Raster format (GS v 0) ───────────────────────────────────────────────

  /**
   * Encode the image as a raw ESC/POS raster data payload (pixel bytes only,
   * **no** `GS v 0` header).
   *
   * Layout: row-major, MSB-first within each byte.
   *   - Bit 7 of byte 0 in each row → leftmost pixel.
   *   - Length = `widthBytes × height` bytes.
   *
   * The caller is responsible for prepending the `GS v 0` command header.
   * `Escpos.image()` handles this internally when `impl === 'bitImageRaster'`.
   *
   * @returns Raw pixel data buffer.
   */
  toRasterFormat(): Buffer {
    const buf = Buffer.alloc(this.widthBytes * this.height, 0);
    for (let y = 0; y < this.height; y++) {
      const rowBase = y * this.widthBytes;
      for (let x = 0; x < this.width; x++) {
        if (this.pixels[y][x]) {
          const byteIndex = rowBase + Math.floor(x / 8);
          const bitShift = 7 - (x % 8); // MSB = leftmost pixel
          buf[byteIndex] |= 1 << bitShift;
        }
      }
    }
    return buf;
  }

  // ── Column format (ESC *) ────────────────────────────────────────────────

  /**
   * Yield column data buffers for ESC * column-format printing.
   *
   * Each yielded Buffer represents the vertical byte-strip for one pixel
   * column. Bits are packed top-to-bottom, MSB at the top.
   *
   * The number of bytes per column depends on `highDensity`:
   *   - Low density  (8-dot):  1 byte per column.
   *   - High density (24-dot): 3 bytes per column.
   *
   * `Escpos.image()` wraps these blobs with the ESC * header and line-feed
   * when `impl === 'bitImageColumn'`.
   *
   * @param highDensity - `true` for 24-dot high-density mode, `false` for
   *   8-dot low-density mode.  Defaults to `false`.
   */
  *toColumnFormat(highDensity = false): Generator<Buffer> {
    const dotsPerSlice = highDensity ? 24 : 8;
    const bytesPerCol = dotsPerSlice / 8; // 3 or 1

    for (let x = 0; x < this.width; x++) {
      for (let rowStart = 0; rowStart < this.height; rowStart += dotsPerSlice) {
        const col = Buffer.alloc(bytesPerCol, 0);
        for (let dot = 0; dot < dotsPerSlice; dot++) {
          const y = rowStart + dot;
          if (y < this.height && this.pixels[y]?.[x]) {
            const byteIndex = Math.floor(dot / 8);
            const bitShift = 7 - (dot % 8);
            col[byteIndex] |= 1 << bitShift;
          }
        }
        yield col;
      }
    }
  }

  // ── Utility ──────────────────────────────────────────────────────────────

  /**
   * Centre the image within `maxWidth` pixels by padding each row with white
   * pixels on the left and right.  If the image is already as wide as or
   * wider than `maxWidth`, this is a no-op.
   *
   * @param maxWidth - Target width in pixels.
   */
  center(maxWidth: number): void {
    if (this.width >= maxWidth) return;
    const pad = Math.floor((maxWidth - this.width) / 2);
    const falsePad = new Array<boolean>(pad).fill(false);
    for (let y = 0; y < this.height; y++) {
      this.pixels[y] = [...falsePad, ...this.pixels[y], ...falsePad];
    }
    // Update readonly properties via type assertion (controlled mutation).
    (this as { width: number }).width = this.pixels[0].length;
    (this as { widthBytes: number }).widthBytes = Math.ceil(this.width / 8);
  }

  /**
   * Split the image into vertical fragments of at most `fragmentHeight` rows.
   *
   * Used by `Escpos.image()` to avoid printer buffer overruns on large images.
   *
   * @param fragmentHeight - Maximum number of rows per fragment.
   * @returns Array of `EscposImage` slices (last slice may be shorter).
   */
  split(fragmentHeight: number): EscposImage[] {
    const result: EscposImage[] = [];
    for (let top = 0; top < this.height; top += fragmentHeight) {
      const slice = this.pixels.slice(top, top + fragmentHeight);
      result.push(new EscposImage(slice, this.width, slice.length));
    }
    return result;
  }
}
