// tests/printers/Usb.test.ts
import { Usb } from '../../src/printers/Usb';
import { USBNotFoundError } from '../../src/errors';

// ── USB hardware mock ──────────────────────────────────────────────────────────
// The `usb` package requires native bindings that are unavailable in CI.
// We replace the entire module with a deterministic fake that covers the
// two devices we care about: 0x04b8/0x0202 (Epson) and a missing device.
//
// LIBUSB_TRANSFER_TYPE_BULK = 2 per the libusb spec.

jest.mock('usb', () => {
  const BULK = 2; // LIBUSB_TRANSFER_TYPE_BULK

  const makeDevice = (vid: number, pid: number) => ({
    deviceDescriptor: { idVendor: vid, idProduct: pid },
    open: jest.fn(),
    close: jest.fn(),
    interface: jest.fn(() => ({
      claim: jest.fn(),
      release: jest.fn((_closeEndpoints: boolean, cb: () => void) => cb()),
      endpoints: [
        {
          direction: 'out',
          address: 1,
          transferType: BULK,
          transfer: jest.fn((data: Buffer, cb: (err: null, n: number) => void) =>
            cb(null, data.length),
          ),
        },
        {
          direction: 'in',
          address: 0x81,
          transferType: BULK,
          transfer: jest.fn((
            _length: number,
            cb: (err: null, data: Buffer) => void,
          ) => cb(null, Buffer.from([0x12, 0x34]))),
        },
      ],
    })),
  });

  return {
    getDeviceList: jest.fn(() => [
      makeDevice(0x04b8, 0x0202),
      makeDevice(0x0519, 0x0003),
    ]),
    findByIds: jest.fn((vid: number, pid: number) =>
      vid === 0x04b8 && pid === 0x0202 ? makeDevice(vid, pid) : undefined,
    ),
    // Expose the constant so Usb.ts can import it without it being undefined
    LIBUSB_TRANSFER_TYPE_BULK: 2,
  };
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('Usb printer', () => {
  // ── listDevices ─────────────────────────────────────────────────────────────

  describe('listDevices()', () => {
    test('returns an array', () => {
      const devices = Usb.listDevices();
      expect(Array.isArray(devices)).toBe(true);
    });

    test('first device has correct vendorId', () => {
      const devices = Usb.listDevices();
      expect(devices[0].vendorId).toBe(0x04b8);
    });

    test('returns all devices from getDeviceList', () => {
      const devices = Usb.listDevices();
      expect(devices).toHaveLength(2);
    });

    test('each entry has vendorId and productId as numbers', () => {
      const devices = Usb.listDevices();
      for (const d of devices) {
        expect(typeof d.vendorId).toBe('number');
        expect(typeof d.productId).toBe('number');
      }
    });
  });

  // ── open ─────────────────────────────────────────────────────────────────────

  describe('open()', () => {
    test('resolves for a known device', async () => {
      const p = new Usb({ vendorId: 0x04b8, productId: 0x0202 });
      await expect(p.open()).resolves.toBeUndefined();
      await p.close();
    });

    test('throws USBNotFoundError for an unknown device', async () => {
      const p = new Usb({ vendorId: 0xdead, productId: 0xbeef });
      await expect(p.open()).rejects.toThrow(USBNotFoundError);
    });

    test('error message contains VID/PID for unknown device', async () => {
      const p = new Usb({ vendorId: 0xdead, productId: 0xbeef });
      await expect(p.open()).rejects.toThrow(/dead.*beef/i);
    });
  });

  // ── _raw ─────────────────────────────────────────────────────────────────────

  describe('_raw()', () => {
    test('throws USBNotFoundError before open()', () => {
      const p = new Usb({ vendorId: 0x04b8, productId: 0x0202 });
      expect(() => p._raw(Buffer.from([0x1b, 0x40]))).toThrow(USBNotFoundError);
    });

    test('does not throw after open()', async () => {
      const p = new Usb({ vendorId: 0x04b8, productId: 0x0202 });
      await p.open();
      expect(() => p._raw(Buffer.from([0x1b, 0x40]))).not.toThrow();
      await p.close();
    });
  });

  // ── read ─────────────────────────────────────────────────────────────────────

  describe('read()', () => {
    test('resolves with a Buffer after open()', async () => {
      const p = new Usb({ vendorId: 0x04b8, productId: 0x0202 });
      await p.open();
      const result = await p.read();
      expect(Buffer.isBuffer(result)).toBe(true);
      await p.close();
    });

    test('rejects with USBNotFoundError before open()', async () => {
      const p = new Usb({ vendorId: 0x04b8, productId: 0x0202 });
      await expect(p.read()).rejects.toThrow(USBNotFoundError);
    });
  });

  // ── close ─────────────────────────────────────────────────────────────────────

  describe('close()', () => {
    test('resolves without error after open()', async () => {
      const p = new Usb({ vendorId: 0x04b8, productId: 0x0202 });
      await p.open();
      await expect(p.close()).resolves.toBeUndefined();
    });

    test('is a no-op when never opened', async () => {
      const p = new Usb({ vendorId: 0x04b8, productId: 0x0202 });
      await expect(p.close()).resolves.toBeUndefined();
    });

    test('can be called twice without error', async () => {
      const p = new Usb({ vendorId: 0x04b8, productId: 0x0202 });
      await p.open();
      await p.close();
      await expect(p.close()).resolves.toBeUndefined();
    });
  });

  // ── Escpos integration ─────────────────────────────────────────────────────

  describe('Escpos methods work after open()', () => {
    test('text() calls _raw internally', async () => {
      const p = new Usb({ vendorId: 0x04b8, productId: 0x0202 });
      await p.open();
      // If _raw fires it hits our mock endpoint — no throw expected
      expect(() => p.text('Hello')).not.toThrow();
      await p.close();
    });

    test('cut() sends a command without error', async () => {
      const p = new Usb({ vendorId: 0x04b8, productId: 0x0202 });
      await p.open();
      expect(() => p.cut('FULL', false)).not.toThrow();
      await p.close();
    });
  });
});
