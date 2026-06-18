/**
 * CJS-compatible manual mock for the `file-type` ESM-only package.
 *
 * Jest runs tests in CommonJS mode (ts-jest preset). `file-type` v21+ is
 * a pure-ESM module that uses `import.meta`; Jest cannot transform it
 * without --experimental-vm-modules.
 *
 * This mock exposes the same API surface that @jimp/core uses:
 *   `fileTypeFromBuffer(buffer) → Promise<{ ext, mime } | undefined>`
 *
 * It performs minimal magic-byte detection sufficient for the image formats
 * supported by jimp (PNG, JPEG, BMP, GIF, TIFF).
 */

'use strict';

/**
 * Detect the MIME type of a Buffer by inspecting its magic bytes.
 *
 * @param {Buffer | Uint8Array | ArrayBuffer} input
 * @returns {Promise<{ ext: string; mime: string } | undefined>}
 */
async function fileTypeFromBuffer(input) {
  let buf;
  if (Buffer.isBuffer(input)) {
    buf = input;
  } else if (input instanceof ArrayBuffer) {
    buf = Buffer.from(input);
  } else if (ArrayBuffer.isView(input)) {
    // Uint8Array or other typed array — respect byteOffset and byteLength
    buf = Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  } else {
    return undefined;
  }
  // Debug: log first 4 bytes
  if (process.env.DEBUG_FILE_TYPE) {
    console.log('[file-type mock] first 4 bytes:', buf.slice(0, 4).toString('hex'), 'length:', buf.length);
  }

  if (buf.length < 4) return undefined;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { ext: 'png', mime: 'image/png' };
  }
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }
  // BMP: 42 4D
  if (buf[0] === 0x42 && buf[1] === 0x4d) {
    return { ext: 'bmp', mime: 'image/bmp' };
  }
  // GIF: 47 49 46 38
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) {
    return { ext: 'gif', mime: 'image/gif' };
  }
  // TIFF: 49 49 (LE) or 4D 4D (BE)
  if (
    (buf[0] === 0x49 && buf[1] === 0x49 && buf[2] === 0x2a && buf[3] === 0x00) ||
    (buf[0] === 0x4d && buf[1] === 0x4d && buf[2] === 0x00 && buf[3] === 0x2a)
  ) {
    return { ext: 'tif', mime: 'image/tiff' };
  }

  return undefined;
}

module.exports = {
  __esModule: true,   // tell Jest/interop this mock behaves as an ES module
  fileTypeFromBuffer,
  default: { fileTypeFromBuffer },
};
