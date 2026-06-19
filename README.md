# escpos-ts

A strictly-typed TypeScript port of [python-escpos](https://github.com/python-escpos/python-escpos) for ESC/POS thermal receipt printers.

This library was converted from python-escpos as part of a new POS project, targeting an offline-first Node.js/Electron environment.

📖 **[API Documentation](https://itsbishalb.github.io/escpos-ts/)**

## Features

- Network (TCP/IP), USB, and in-memory (Dummy) printer connections
- Full printer profile system with per-model capability detection
- Text formatting — bold, underline, alignment, font size, custom character sets
- Barcodes (Code128, EAN13, QR codes, and more)
- Raster image printing
- Auto encoding detection via `MagicEncode`
- Strictly typed with zero `any` — full TypeDoc API documentation

## Installation

```bash
npm install escpos-ts
```

## Quick Start

```ts
import { Network, QR_ECLEVEL_M } from 'escpos-ts';

const printer = new Network({ host: '192.168.1.100', port: 9100 });
await printer.open();

printer.hw('INIT');
printer.setWithDefault({ bold: true, align: 'center' });
printer.textln('My Shop');
printer.setWithDefault();

printer.textln('Ref: Invoice #INV-10042');
printer.barcode('012345678905', 'EAN13');

await printer.qr('https://myshop.com', { ec: QR_ECLEVEL_M });

printer.cut();
await printer.close();
```

## Connection Types

| Class | Transport | Notes |
|---|---|---|
| `Network` | TCP/IP (`net.Socket`) | Most common for POS setups |
| `Usb` | USB bulk transfer (`usb` / libusb) | Requires udev rules on Linux |
| `Dummy` | In-memory buffer | Useful for testing |

## Printer Profiles

```ts
import { ProfileManager } from 'escpos-ts';

const profiles = ProfileManager.listProfiles();
const profile = ProfileManager.getProfile('TM-T88V');

const printer = new Network({ host: '192.168.1.100', profileName: 'TM-T88V' });
```

## Credits

Ported from [python-escpos](https://github.com/python-escpos/python-escpos).
