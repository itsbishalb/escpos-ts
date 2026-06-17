// src/errors.ts

export class EscposError extends Error {
  resultCode: number;

  constructor(msg: string, code = 1) {
    super(msg);
    this.name = 'EscposError';
    this.resultCode = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class BarcodeTypeError extends EscposError {
  constructor(msg = '') {
    super(`No Barcode type is defined (${msg})`, 10);
    this.name = 'BarcodeTypeError';
  }
}

export class BarcodeSizeError extends EscposError {
  constructor(msg = '') {
    super(`Barcode size is out of range (${msg})`, 20);
    this.name = 'BarcodeSizeError';
  }
}

export class BarcodeCodeError extends EscposError {
  constructor(msg = '') {
    super(`No Barcode code was supplied (${msg})`, 30);
    this.name = 'BarcodeCodeError';
  }
}

export class ImageSizeError extends EscposError {
  constructor(msg = '') {
    super(`Image height is longer than 255px and can't be printed (${msg})`, 40);
    this.name = 'ImageSizeError';
  }
}

export class ImageWidthError extends EscposError {
  constructor(msg = '') {
    super(`Image width is too large (${msg})`, 41);
    this.name = 'ImageWidthError';
  }
}

export class TextError extends EscposError {
  constructor(msg = '') {
    super(`Text string must be supplied to the text() method (${msg})`, 50);
    this.name = 'TextError';
  }
}

export class CashDrawerError extends EscposError {
  constructor(msg = '') {
    super(`Valid pin must be set to send pulse (${msg})`, 60);
    this.name = 'CashDrawerError';
  }
}

export class TabPosError extends EscposError {
  constructor(msg = '') {
    super(`Valid tab positions must be in the range 0 to 16 (${msg})`, 70);
    this.name = 'TabPosError';
  }
}

export class CharCodeError extends EscposError {
  constructor(msg = '') {
    super(`Valid char code must be set (${msg})`, 80);
    this.name = 'CharCodeError';
  }
}

export class DeviceNotFoundError extends EscposError {
  constructor(msg = '') {
    super(`Device not found (${msg})`, 90);
    this.name = 'DeviceNotFoundError';
  }
}

export class USBNotFoundError extends DeviceNotFoundError {
  constructor(msg = '') {
    super(msg);
    this.resultCode = 91;
    this.message = `USB device not found (${msg})`;
    this.name = 'USBNotFoundError';
  }
}

export class SetVariableError extends EscposError {
  constructor(msg = '') {
    super(`Set variable out of range (${msg})`, 100);
    this.name = 'SetVariableError';
  }
}

export class ConfigNotFoundError extends EscposError {
  constructor(msg = '') {
    super(`Configuration not found (${msg})`, 200);
    this.name = 'ConfigNotFoundError';
  }
}

export class ConfigSyntaxError extends EscposError {
  constructor(msg = '') {
    super(`Configuration syntax is invalid (${msg})`, 210);
    this.name = 'ConfigSyntaxError';
  }
}

export class ConfigSectionMissingError extends EscposError {
  constructor(msg = '') {
    super(`Configuration section is missing (${msg})`, 220);
    this.name = 'ConfigSectionMissingError';
  }
}
