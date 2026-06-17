// tests/constants.test.ts
import {
  ESC, GS, NUL,
  HW_INIT, PAPER_FULL_CUT, PAPER_PART_CUT,
  CD_KICK_2, CD_KICK_5,
  TXT_NORMAL, CODEPAGE_CHANGE,
  BARCODE_HEIGHT, BARCODE_WIDTH,
  BARCODE_TYPE_A, BARCODE_TYPE_B,
  QR_ECLEVEL_L, QR_ECLEVEL_M, QR_ECLEVEL_Q, QR_ECLEVEL_H,
  QR_MODEL_1, QR_MODEL_2, QR_MICRO,
  S_RASTER_N,
  RT_STATUS_ONLINE, RT_STATUS_PAPER,
  intLowHigh,
} from '../src/constants';

describe('control bytes', () => {
  test('ESC is 0x1b', () => expect(ESC).toEqual(Buffer.from([0x1b])));
  test('GS is 0x1d',  () => expect(GS).toEqual(Buffer.from([0x1d])));
  test('NUL is 0x00', () => expect(NUL).toEqual(Buffer.from([0x00])));
});

describe('hardware commands', () => {
  test('HW_INIT is ESC @', () => expect(HW_INIT).toEqual(Buffer.from([0x1b, 0x40])));
  test('PAPER_FULL_CUT is GS V 0', () => expect(PAPER_FULL_CUT).toEqual(Buffer.from([0x1d, 0x56, 0x00])));
  test('CD_KICK_2 sends pin 2 pulse', () => expect(CD_KICK_2[0]).toBe(0x1b));
});

describe('barcode commands', () => {
  test('BARCODE_TYPE_A has UPC-A', () => expect(BARCODE_TYPE_A['UPC-A']).toBeDefined());
  test('BARCODE_TYPE_B has CODE128', () => expect(BARCODE_TYPE_B['CODE128']).toBeDefined());
  test('BARCODE_HEIGHT prefix', () => expect(BARCODE_HEIGHT).toEqual(Buffer.from([0x1d, 0x68])));
});

describe('QR constants', () => {
  test('error levels', () => {
    expect(QR_ECLEVEL_L).toBe(0);
    expect(QR_ECLEVEL_M).toBe(1);
    expect(QR_ECLEVEL_Q).toBe(2);
    expect(QR_ECLEVEL_H).toBe(3);
  });
  test('models', () => {
    expect(QR_MODEL_1).toBe(1);
    expect(QR_MODEL_2).toBe(2);
    expect(QR_MICRO).toBe(3);
  });
});

describe('intLowHigh', () => {
  test('encodes 256 in 2 bytes as [0, 1]', () =>
    expect(intLowHigh(256, 2)).toEqual(Buffer.from([0x00, 0x01])));
  test('encodes 0 in 2 bytes as [0, 0]', () =>
    expect(intLowHigh(0, 2)).toEqual(Buffer.from([0x00, 0x00])));
  test('encodes 300 in 2 bytes as [44, 1]', () =>
    expect(intLowHigh(300, 2)).toEqual(Buffer.from([44, 1])));
});
