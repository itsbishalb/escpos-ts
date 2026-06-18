// tests/qr/QrHelper.test.ts
import { QrHelper } from '../../src/qr/QrHelper';
import {
  QR_ECLEVEL_L, QR_ECLEVEL_M, QR_ECLEVEL_Q, QR_ECLEVEL_H,
  QR_MODEL_1, QR_MODEL_2, QR_MICRO,
} from '../../src/constants';

// GS ( k header bytes
const GS  = 0x1d;
const LP  = 0x28; // (
const K   = 0x6b; // k
const CN  = 0x31; // cn = 49

describe('QrHelper', () => {
  describe('generate() — basic structure', () => {
    test('returns a non-empty Buffer', () => {
      const buf = QrHelper.generate('Hello');
      expect(buf).toBeInstanceOf(Buffer);
      expect(buf.length).toBeGreaterThan(0);
    });

    test('starts with GS ( k', () => {
      const buf = QrHelper.generate('A');
      expect(buf[0]).toBe(GS);
      expect(buf[1]).toBe(LP);
      expect(buf[2]).toBe(K);
    });

    test('cn byte is 0x31 for first packet', () => {
      const buf = QrHelper.generate('A');
      // bytes 0-2: GS ( k; 3-4: pL pH; 5: cn; 6: fn
      expect(buf[5]).toBe(CN);
    });
  });

  describe('generate() — set model packet (fn = 0x41)', () => {
    test('fn byte for set-model is 0x41', () => {
      const buf = QrHelper.generate('X');
      // Packet 1 offset: [GS ( k] [pL pH] [cn] [fn] ...
      // 0,1,2 = GS ( k; 3,4 = pL,pH; 5 = cn; 6 = fn
      expect(buf[6]).toBe(0x41);
    });

    test('model byte defaults to QR_MODEL_2 (50 = 48+2)', () => {
      const buf = QrHelper.generate('X');
      // Payload for set model: [model_byte, 0x00]
      // model_byte = 48 + QR_MODEL_2 = 50
      expect(buf[7]).toBe(48 + QR_MODEL_2); // 50
      expect(buf[8]).toBe(0x00);
    });

    test('QR_MODEL_1 sets model byte to 49', () => {
      const buf = QrHelper.generate('X', { model: QR_MODEL_1 });
      expect(buf[7]).toBe(48 + QR_MODEL_1); // 49
    });

    test('QR_MICRO sets model byte to 51', () => {
      const buf = QrHelper.generate('X', { model: QR_MICRO });
      expect(buf[7]).toBe(48 + QR_MICRO); // 51
    });
  });

  describe('generate() — set size packet (fn = 0x43)', () => {
    test('set-size packet starts at correct offset with GS ( k', () => {
      // Packet 1: [GS(k] pL pH [cn fn model_byte 0x00] = 9 bytes
      const buf = QrHelper.generate('X');
      const pkt2Start = 9;
      expect(buf[pkt2Start]).toBe(GS);
      expect(buf[pkt2Start + 1]).toBe(LP);
      expect(buf[pkt2Start + 2]).toBe(K);
    });

    test('fn byte for set-size is 0x43', () => {
      const buf = QrHelper.generate('X');
      // Packet 2: offset 9; [GS ( k] = 3, [pL pH] = 2, [cn] = 1, [fn] = 1 → fn at 9+6=15
      expect(buf[9 + 5]).toBe(CN);
      expect(buf[9 + 6]).toBe(0x43);
    });

    test('default size is 3', () => {
      const buf = QrHelper.generate('X');
      expect(buf[9 + 7]).toBe(3);
    });

    test('custom size 7 is reflected', () => {
      const buf = QrHelper.generate('X', { size: 7 });
      expect(buf[9 + 7]).toBe(7);
    });
  });

  describe('generate() — set error correction packet (fn = 0x45)', () => {
    test('set-ec packet fn is 0x45', () => {
      const buf = QrHelper.generate('X');
      // Packet 3 starts at offset 9+8 = 17
      const pkt3Start = 17;
      expect(buf[pkt3Start]).toBe(GS);
      expect(buf[pkt3Start + 5]).toBe(CN);
      expect(buf[pkt3Start + 6]).toBe(0x45);
    });

    test('default eclevel is QR_ECLEVEL_L (48+0=48)', () => {
      const buf = QrHelper.generate('X');
      const pkt3Start = 17;
      expect(buf[pkt3Start + 7]).toBe(48 + QR_ECLEVEL_L); // 48
    });

    test('QR_ECLEVEL_M sets byte 49', () => {
      const buf = QrHelper.generate('X', { eclevel: QR_ECLEVEL_M });
      const pkt3Start = 17;
      expect(buf[pkt3Start + 7]).toBe(48 + QR_ECLEVEL_M); // 49
    });

    test('QR_ECLEVEL_Q sets byte 50', () => {
      const buf = QrHelper.generate('X', { eclevel: QR_ECLEVEL_Q });
      const pkt3Start = 17;
      expect(buf[pkt3Start + 7]).toBe(50);
    });

    test('QR_ECLEVEL_H sets byte 51', () => {
      const buf = QrHelper.generate('X', { eclevel: QR_ECLEVEL_H });
      const pkt3Start = 17;
      expect(buf[pkt3Start + 7]).toBe(51);
    });
  });

  describe('generate() — store data packet (fn = 0x50)', () => {
    test('store-data fn byte is 0x50', () => {
      const buf = QrHelper.generate('A');
      // fixed headers: pkt1=9, pkt2=8, pkt3=8 → pkt4 at 25
      const pkt4Start = 25;
      expect(buf[pkt4Start]).toBe(GS);
      expect(buf[pkt4Start + 5]).toBe(CN);
      expect(buf[pkt4Start + 6]).toBe(0x50);
    });

    test('m byte before data is 0x30', () => {
      const buf = QrHelper.generate('A');
      const pkt4Start = 25;
      expect(buf[pkt4Start + 7]).toBe(0x30);
    });

    test('data section contains UTF-8 bytes of input text', () => {
      const text = 'Hello';
      const buf = QrHelper.generate(text);
      const textBytes = Buffer.from(text, 'utf8');
      const pkt4Start = 25;
      const dataStart = pkt4Start + 8; // skip GS ( k pL pH cn fn m
      const slice = buf.slice(dataStart, dataStart + textBytes.length);
      expect(slice).toEqual(textBytes);
    });

    test('data section contains UTF-8 bytes of URL', () => {
      const url = 'https://example.com';
      const buf = QrHelper.generate(url);
      const urlBytes = Buffer.from(url, 'utf8');
      const pkt4Start = 25;
      const dataStart = pkt4Start + 8;
      const slice = buf.slice(dataStart, dataStart + urlBytes.length);
      expect(slice).toEqual(urlBytes);
    });

    test('pL/pH reflect correct payload length for store data', () => {
      const text = 'AB'; // 2 bytes
      const buf = QrHelper.generate(text);
      const pkt4Start = 25;
      // payloadLen = m(1) + data(2) + 2 = 5
      const pL = buf[pkt4Start + 3];
      const pH = buf[pkt4Start + 4];
      const payloadLen = pL + (pH << 8);
      expect(payloadLen).toBe(1 + 2 + 2); // m + data + cn + fn
    });
  });

  describe('generate() — print packet (fn = 0x51)', () => {
    test('print packet fn is 0x51', () => {
      const text = 'A'; // 1 UTF-8 byte
      const buf = QrHelper.generate(text);
      // pkt4 size = 3+2+1+1+1+1 = 9 bytes; pkt4Start=25 → pkt5 at 34
      const pkt5Start = 25 + 9;
      expect(buf[pkt5Start]).toBe(GS);
      expect(buf[pkt5Start + 5]).toBe(CN);
      expect(buf[pkt5Start + 6]).toBe(0x51);
    });

    test('print packet m byte is 0x30', () => {
      const text = 'A';
      const buf = QrHelper.generate(text);
      const pkt5Start = 25 + 9;
      expect(buf[pkt5Start + 7]).toBe(0x30);
    });

    test('print packet pL/pH encode payload of 3 (cn + fn + m)', () => {
      const text = 'A';
      const buf = QrHelper.generate(text);
      const pkt5Start = 25 + 9;
      const pL = buf[pkt5Start + 3];
      const pH = buf[pkt5Start + 4];
      const payloadLen = pL + (pH << 8);
      expect(payloadLen).toBe(3); // cn(1) + fn(1) + m(1)
    });
  });

  describe('generate() — total buffer length', () => {
    test('total length is correct for single-byte ASCII', () => {
      // pkt1=9, pkt2=8, pkt3=8, pkt4=3+2+1+1+1+textLen=8+textLen, pkt5=8
      // total = 9+8+8+8+1+8 = 42 for 1-byte text
      const buf = QrHelper.generate('A');
      expect(buf.length).toBe(42);
    });

    test('total length grows with text length', () => {
      const buf5  = QrHelper.generate('Hello');
      const buf10 = QrHelper.generate('HelloWorld');
      expect(buf10.length - buf5.length).toBe(5);
    });
  });

  describe('generate() — validation', () => {
    test('throws RangeError for empty text', () => {
      expect(() => QrHelper.generate('')).toThrow(RangeError);
    });

    test('throws RangeError for size 0', () => {
      expect(() => QrHelper.generate('X', { size: 0 })).toThrow(RangeError);
    });

    test('throws RangeError for size 17', () => {
      expect(() => QrHelper.generate('X', { size: 17 })).toThrow(RangeError);
    });

    test('accepts size boundary 1', () => {
      expect(() => QrHelper.generate('X', { size: 1 })).not.toThrow();
    });

    test('accepts size boundary 16', () => {
      expect(() => QrHelper.generate('X', { size: 16 })).not.toThrow();
    });

    test('throws RangeError for invalid model', () => {
      expect(() => QrHelper.generate('X', { model: 99 })).toThrow(RangeError);
    });

    test('throws RangeError for invalid eclevel', () => {
      expect(() => QrHelper.generate('X', { eclevel: 10 })).toThrow(RangeError);
    });
  });

  describe('generate() — multi-byte UTF-8', () => {
    test('handles multi-byte UTF-8 text (emoji)', () => {
      const text = '★'; // U+2605 → 3 UTF-8 bytes: E2 98 85
      const buf = QrHelper.generate(text);
      expect(buf).toBeInstanceOf(Buffer);
      const textBytes = Buffer.from(text, 'utf8');
      const pkt4Start = 25;
      const dataStart = pkt4Start + 8;
      const slice = buf.slice(dataStart, dataStart + textBytes.length);
      expect(slice).toEqual(textBytes);
    });

    test('handles a longer URL', () => {
      const url = 'https://example.com/path?query=1&foo=bar';
      const buf = QrHelper.generate(url);
      expect(buf).toBeInstanceOf(Buffer);
      expect(buf.length).toBeGreaterThan(50);
    });
  });
});
