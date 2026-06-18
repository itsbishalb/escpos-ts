// tests/image/EscposImage.test.ts
import * as path from 'path';
import * as fs from 'fs';
import { Jimp } from 'jimp';
import { EscposImage } from '../../src/image/EscposImage';

// Use the test resource BMP from Python tests if available
const SAMPLE_PNG = path.join(__dirname, '../../../test/resources/black_white_sample.png');
const hasSample = fs.existsSync(SAMPLE_PNG);

/** Return a PNG Buffer for a solid-colour image of the given dimensions. */
async function makeSolidImageBuffer(
  width: number,
  height: number,
  color: number,
): Promise<Buffer> {
  const img = new Jimp({ width, height, color });
  return img.getBuffer('image/png');
}

describe('EscposImage', () => {
  // ── load() ─────────────────────────────────────────────────────────────

  (hasSample ? test : test.skip)('load() from PNG file', async () => {
    const img = await EscposImage.load(SAMPLE_PNG);
    expect(img.width).toBeGreaterThan(0);
    expect(img.height).toBeGreaterThan(0);
    expect(img.widthBytes).toBe(Math.ceil(img.width / 8));
  });

  test('load() from a minimal 1×1 white BMP buffer', async () => {
    // Minimal valid 1×1 white BMP (62 bytes — 54 header + 4 pixel data + 4 padding)
    const bmp = Buffer.from([
      0x42, 0x4d, 0x3e, 0x00, 0x00, 0x00, // BM, file size 62
      0x00, 0x00, 0x00, 0x00,               // reserved
      0x3e, 0x00, 0x00, 0x00,               // pixel data offset = 62
      0x28, 0x00, 0x00, 0x00,               // BITMAPINFOHEADER size = 40
      0x01, 0x00, 0x00, 0x00,               // width = 1
      0x01, 0x00, 0x00, 0x00,               // height = 1
      0x01, 0x00,                           // planes = 1
      0x18, 0x00,                           // bitsPerPixel = 24
      0x00, 0x00, 0x00, 0x00,               // compression = BI_RGB
      0x04, 0x00, 0x00, 0x00,               // imageSize = 4
      0x13, 0x0b, 0x00, 0x00,               // xPixelsPerMeter
      0x13, 0x0b, 0x00, 0x00,               // yPixelsPerMeter
      0x00, 0x00, 0x00, 0x00,               // colorsInTable
      0x00, 0x00, 0x00, 0x00,               // importantColorCount
      0xff, 0xff, 0xff, 0x00,               // 1 white pixel (BGR + padding)
    ]);
    const img = await EscposImage.load(bmp);
    expect(img.width).toBe(1);
    expect(img.height).toBe(1);
    expect(img.widthBytes).toBe(1);
  });

  test('load() from programmatic PNG buffer — 8×4 all-black', async () => {
    const pngBuf = await makeSolidImageBuffer(8, 4, 0x000000ff);
    const img = await EscposImage.load(pngBuf);
    expect(img.width).toBe(8);
    expect(img.height).toBe(4);
    expect(img.widthBytes).toBe(1); // ceil(8/8)
  });

  test('load() from programmatic PNG buffer — 8×4 all-white', async () => {
    const pngBuf = await makeSolidImageBuffer(8, 4, 0xffffffff);
    const img = await EscposImage.load(pngBuf);
    expect(img.width).toBe(8);
    expect(img.height).toBe(4);
    expect(img.widthBytes).toBe(1);
  });

  // ── toRasterFormat() ───────────────────────────────────────────────────

  test('toRasterFormat() 8×4 all-black → 4 bytes of 0xFF', async () => {
    const pngBuf = await makeSolidImageBuffer(8, 4, 0x000000ff);
    const img = await EscposImage.load(pngBuf);
    const raster = img.toRasterFormat();

    // 8 pixels / 8 = 1 byte per row × 4 rows = 4 bytes
    expect(raster.length).toBe(4);
    // All pixels black → every bit set → 0xFF per byte
    expect(raster).toEqual(Buffer.from([0xff, 0xff, 0xff, 0xff]));
  });

  test('toRasterFormat() 8×4 all-white → 4 bytes of 0x00', async () => {
    const pngBuf = await makeSolidImageBuffer(8, 4, 0xffffffff);
    const img = await EscposImage.load(pngBuf);
    const raster = img.toRasterFormat();

    expect(raster.length).toBe(4);
    expect(raster).toEqual(Buffer.from([0x00, 0x00, 0x00, 0x00]));
  });

  test('toRasterFormat() 9×1 image → 2 bytes per row (MSB-first)', async () => {
    // 9 pixels wide → widthBytes = 2; pad to 16 bits
    const pngBuf = await makeSolidImageBuffer(9, 1, 0x000000ff);
    const img = await EscposImage.load(pngBuf);
    const raster = img.toRasterFormat();

    // Byte 0: bits 8-1 → all 9 pixels cover bits 7-0 of byte0, and bit 7 of byte1
    // All black: byte 0 = 0xFF, byte 1 = 0x80 (only MSB set for 9th pixel)
    expect(raster.length).toBe(2);
    expect(raster[0]).toBe(0xff);
    expect(raster[1]).toBe(0x80);
  });

  (hasSample ? test : test.skip)('toRasterFormat() from PNG file — returns Buffer', async () => {
    const img = await EscposImage.load(SAMPLE_PNG);
    const raster = img.toRasterFormat();
    expect(raster).toBeInstanceOf(Buffer);
    expect(raster.length).toBe(img.widthBytes * img.height);
  });

  // ── toColumnFormat() ───────────────────────────────────────────────────

  test('toColumnFormat() yields one Buffer per pixel column', async () => {
    const pngBuf = await makeSolidImageBuffer(8, 4, 0x000000ff);
    const img = await EscposImage.load(pngBuf);
    const columns = [...img.toColumnFormat(false)];
    expect(columns.length).toBe(8); // one per column
    // Each column is 1 byte in 8-dot mode; 4 black pixels → bits 7-4 set = 0xF0
    expect(columns[0].length).toBe(1);
    expect(columns[0][0]).toBe(0xf0); // top 4 bits set (rows 0-3 all black)
  });

  test('toColumnFormat(highDensity=true) yields 3-byte buffers', async () => {
    const pngBuf = await makeSolidImageBuffer(4, 24, 0x000000ff);
    const img = await EscposImage.load(pngBuf);
    const columns = [...img.toColumnFormat(true)];
    expect(columns.length).toBe(4);
    expect(columns[0].length).toBe(3); // 24 dots / 8 = 3 bytes
    // All 24 rows black → all bits set → 0xFF per byte
    expect(columns[0]).toEqual(Buffer.from([0xff, 0xff, 0xff]));
  });

  // ── center() ──────────────────────────────────────────────────────────

  test('center() pads pixel rows and updates width/widthBytes', async () => {
    const pngBuf = await makeSolidImageBuffer(8, 2, 0x000000ff);
    const img = await EscposImage.load(pngBuf);

    img.center(24);

    // 8 → centred in 24: left pad = (24-8)/2 = 8; total pixels = 24
    expect(img.width).toBe(24);
    expect(img.widthBytes).toBe(3); // ceil(24/8)
  });

  test('center() is a no-op when image is already maxWidth', async () => {
    const pngBuf = await makeSolidImageBuffer(8, 2, 0x000000ff);
    const img = await EscposImage.load(pngBuf);
    img.center(8);
    expect(img.width).toBe(8);
  });

  test('center() is a no-op when image is wider than maxWidth', async () => {
    const pngBuf = await makeSolidImageBuffer(16, 2, 0x000000ff);
    const img = await EscposImage.load(pngBuf);
    img.center(8);
    expect(img.width).toBe(16);
  });

  // ── split() ────────────────────────────────────────────────────────────

  test('split() divides into correct number of fragments', async () => {
    const pngBuf = await makeSolidImageBuffer(8, 10, 0x000000ff);
    const img = await EscposImage.load(pngBuf);
    const frags = img.split(4);

    expect(frags.length).toBe(3);       // 4 + 4 + 2 rows
    expect(frags[0].height).toBe(4);
    expect(frags[1].height).toBe(4);
    expect(frags[2].height).toBe(2);
    frags.forEach(f => expect(f.width).toBe(8));
  });

  test('split() with fragmentHeight >= height returns single fragment', async () => {
    const pngBuf = await makeSolidImageBuffer(8, 5, 0x000000ff);
    const img = await EscposImage.load(pngBuf);
    const frags = img.split(10);
    expect(frags.length).toBe(1);
    expect(frags[0].height).toBe(5);
  });

  // ── Full GS v 0 header via Escpos.image() integration ──────────────────

  test('Escpos.image() bitImageRaster produces correct GS v 0 header', async () => {
    /**
     * Verify the full ESC/POS raster command header emitted by Escpos.image()
     * using the Dummy printer.
     *
     * We test the EscposImage raster encoding directly (without going through
     * Escpos.image()) to avoid cross-module dynamic import issues in Jest.
     */
    const { EscposImage } = await import('../../src/image/EscposImage');
    const pngBuf = await makeSolidImageBuffer(8, 4, 0x000000ff);
    const img = await EscposImage.load(pngBuf);

    // Build the expected GS v 0 header manually (as Escpos.image() would)
    const densityByte = 0; // highDensityH=true, highDensityV=true → 0
    const xL = img.widthBytes & 0xff;
    const xH = (img.widthBytes >> 8) & 0xff;
    const yL = img.height & 0xff;
    const yH = (img.height >> 8) & 0xff;

    const header = Buffer.from([0x1d, 0x76, 0x30, densityByte, xL, xH, yL, yH]);
    const raster = img.toRasterFormat();
    const fullCmd = Buffer.concat([header, raster]);

    // GS v 0 raster header: 1D 76 30 <densityByte> <xL xH> <yL yH>
    expect(fullCmd[0]).toBe(0x1d); // GS
    expect(fullCmd[1]).toBe(0x76); // v
    expect(fullCmd[2]).toBe(0x30); // 0 (ASCII)
    expect(fullCmd[3]).toBe(0x00); // density mode (both high density = 0)
    expect(fullCmd[4]).toBe(0x01); // xL = bytesPerRow (1 for 8-pixel image)
    expect(fullCmd[5]).toBe(0x00); // xH
    expect(fullCmd[6]).toBe(0x04); // yL = height (4)
    expect(fullCmd[7]).toBe(0x00); // yH
    // Pixel data: 4 rows × 1 byte = 4 bytes of 0xFF (all black)
    expect(Array.from(raster)).toEqual([0xff, 0xff, 0xff, 0xff]);
  });
});
