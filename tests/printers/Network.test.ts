// tests/printers/Network.test.ts
import * as net from 'net';
import { Network } from '../../src/printers/Network';
import { DeviceNotFoundError } from '../../src/errors';

// ── Real TCP server integration tests ─────────────────────────────────────────
// These tests spin up a real local TCP server on a random port. No mocking needed.

describe('Network printer (real TCP server)', () => {
  let server: net.Server;
  let port: number;
  let receivedChunks: Buffer[];
  let serverSocket: net.Socket | null;

  beforeAll((done) => {
    server = net.createServer((socket) => {
      serverSocket = socket;
      socket.on('data', (chunk: Buffer) => {
        receivedChunks.push(chunk);
      });
    });
    // Listen on a random free port
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as net.AddressInfo;
      port = addr.port;
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  beforeEach(() => {
    receivedChunks = [];
    serverSocket = null;
  });

  test('open() connects to local server', async () => {
    const printer = new Network({ host: '127.0.0.1', port });
    await expect(printer.open()).resolves.toBeUndefined();
    await printer.close();
  });

  test('_raw() sends bytes that arrive on the server', async () => {
    const printer = new Network({ host: '127.0.0.1', port });
    await printer.open();

    const payload = Buffer.from([0x1b, 0x40, 0x48, 0x65, 0x6c, 0x6c, 0x6f]);
    printer._raw(payload);

    // Give the event loop a moment to flush the write
    await new Promise<void>((res) => setTimeout(res, 50));

    const received = Buffer.concat(receivedChunks);
    expect(received.equals(payload)).toBe(true);

    await printer.close();
  });

  test('read() resolves with data sent by server', async () => {
    const printer = new Network({ host: '127.0.0.1', port });
    await printer.open();

    // Wait briefly so serverSocket is populated from the server's 'connection' handler
    await new Promise<void>((res) => setTimeout(res, 20));

    const expected = Buffer.from([0xaa, 0xbb, 0xcc]);
    const readPromise = printer.read(3);

    // Server sends data to the client
    serverSocket!.write(expected);

    const result = await readPromise;
    expect(result.equals(expected)).toBe(true);

    await printer.close();
  });

  test('read() with no length argument returns full chunk', async () => {
    const printer = new Network({ host: '127.0.0.1', port });
    await printer.open();

    await new Promise<void>((res) => setTimeout(res, 20));

    const expected = Buffer.from([0x01, 0x02, 0x03, 0x04]);
    const readPromise = printer.read();

    serverSocket!.write(expected);

    const result = await readPromise;
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]).toBe(0x01);

    await printer.close();
  });

  test('close() can be called twice without error', async () => {
    const printer = new Network({ host: '127.0.0.1', port });
    await printer.open();
    await printer.close();
    await expect(printer.close()).resolves.toBeUndefined();
  });

  test('_raw() before open() throws DeviceNotFoundError', () => {
    const printer = new Network({ host: '127.0.0.1', port });
    expect(() => printer._raw(Buffer.from([0x01]))).toThrow(DeviceNotFoundError);
  });

  test('read() before open() rejects with DeviceNotFoundError', async () => {
    const printer = new Network({ host: '127.0.0.1', port });
    await expect(printer.read()).rejects.toThrow(DeviceNotFoundError);
  });

  test('open() then close() then open() reconnects successfully', async () => {
    const printer = new Network({ host: '127.0.0.1', port });
    await printer.open();
    await printer.close();
    await expect(printer.open()).resolves.toBeUndefined();
    await printer.close();
  });

  test('open() rejects with DeviceNotFoundError when nothing listens on port', async () => {
    // Pick an arbitrary port that is almost certainly not in use
    const unusedPort = 19741;
    const printer = new Network({ host: '127.0.0.1', port: unusedPort, timeout: 2000 });
    await expect(printer.open()).rejects.toThrow(DeviceNotFoundError);
  });

  test('connection timeout rejects with DeviceNotFoundError', async () => {
    // 203.0.113.x is TEST-NET-3 per RFC 5737 — routable but no host responds
    // Using a very short timeout so the test does not hang
    const printer = new Network({ host: '203.0.113.1', port: 9100, timeout: 200 });
    await expect(printer.open()).rejects.toThrow(DeviceNotFoundError);
  }, 3000);

  test('close() is a no-op when not connected', async () => {
    const printer = new Network({ host: '127.0.0.1', port });
    // Never called open() — close() should resolve immediately
    await expect(printer.close()).resolves.toBeUndefined();
  });
});
