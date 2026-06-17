// tests/errors.test.ts
import {
  EscposError, BarcodeTypeError, BarcodeSizeError, BarcodeCodeError,
  ImageSizeError, ImageWidthError, TextError, CashDrawerError,
  TabPosError, CharCodeError, DeviceNotFoundError, USBNotFoundError,
  SetVariableError, ConfigNotFoundError, ConfigSyntaxError,
  ConfigSectionMissingError,
} from '../src/errors';

describe('EscposError base', () => {
  test('is an instance of Error', () => {
    const e = new EscposError('base');
    expect(e).toBeInstanceOf(Error);
  });
  test('message matches msg', () => {
    const e = new EscposError('hello');
    expect(e.message).toBe('hello');
  });
  test('default resultCode is 1', () => {
    expect(new EscposError('x').resultCode).toBe(1);
  });
});

const cases: [new (msg?: string) => EscposError, number, string][] = [
  [BarcodeTypeError,          10, 'No Barcode type'],
  [BarcodeSizeError,          20, 'Barcode size is out of range'],
  [BarcodeCodeError,          30, 'No Barcode code'],
  [ImageSizeError,            40, 'Image height'],
  [ImageWidthError,           41, 'Image width'],
  [TextError,                 50, 'Text string'],
  [CashDrawerError,           60, 'Valid pin'],
  [TabPosError,               70, 'tab'],
  [CharCodeError,             80, 'char code'],
  [DeviceNotFoundError,       90, 'Device not found'],
  [USBNotFoundError,          91, 'USB device'],
  [SetVariableError,         100, 'Set variable'],
  [ConfigNotFoundError,      200, 'Configuration not found'],
  [ConfigSyntaxError,        210, 'syntax'],
  [ConfigSectionMissingError,220, 'section'],
];

test.each(cases)('%s has correct resultCode %d', (Cls, code) => {
  expect(new Cls().resultCode).toBe(code);
});

test.each(cases)('%s message contains expected string', (Cls, _code, substr) => {
  const msg = new Cls('detail').message.toLowerCase();
  expect(msg).toContain(substr.toLowerCase());
});
