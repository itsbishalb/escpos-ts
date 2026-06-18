// src/Escpos.ts
import {
  ESC, GS, NUL,
  TXT_STYLE, TXT_NORMAL, TXT_SIZE,
  LINESPACING_RESET, LINESPACING_FUNCS,
  HW_INIT, HW_SELECT, HW_RESET,
  CD_KICK_2, CD_KICK_5, cashDrawerDecSequence,
  PAPER_FULL_CUT, PAPER_PART_CUT,
  BARCODE_HEIGHT, BARCODE_WIDTH,
  BARCODE_FONT_A, BARCODE_FONT_B,
  BARCODE_TXT_OFF, BARCODE_TXT_ABV, BARCODE_TXT_BLW, BARCODE_TXT_BTH,
  BARCODE_TYPES, BARCODE_FORMATS,
  LINE_DISPLAY_OPEN, LINE_DISPLAY_CLOSE, LINE_DISPLAY_CLEAR,
  QR_ECLEVEL_L, QR_ECLEVEL_M, QR_ECLEVEL_Q, QR_ECLEVEL_H,
  QR_MODEL_1, QR_MODEL_2, QR_MICRO,
  intLowHigh,
  setFont,
} from './constants';
import {
  BarcodeTypeError, BarcodeSizeError, BarcodeCodeError,
  CashDrawerError, SetVariableError, TabPosError, ImageWidthError,
} from './errors';
import { MagicEncode } from './MagicEncode';
import { ProfileManager } from './profiles/ProfileManager';
import type { PrinterProfile } from './profiles/types';

export type Alignment = 'left' | 'center' | 'right' | 'justify';
export type FontName = 'a' | 'b';

export interface TextStyleOptions {
  align?: 'left' | 'center' | 'right';
  font?: string;
  bold?: boolean;
  underline?: 0 | 1 | 2;
  width?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  height?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  density?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  invert?: boolean;
  smooth?: boolean;
  flip?: boolean;
  normalTextSize?: boolean;
  doubleWidth?: boolean;
  doubleHeight?: boolean;
  customSize?: boolean;
}

export interface BarcodeOptions {
  height?: number;
  width?: number;
  pos?: 'ABOVE' | 'BELOW' | 'BOTH' | 'OFF';
  font?: 'A' | 'B';
  alignCenter?: boolean;
  functionType?: 'A' | 'B';
  check?: boolean;
}

export interface QrOptions {
  ec?: number;
  size?: number;
  model?: number;
  native?: boolean;
  center?: boolean;
}

export interface ImageOptions {
  highDensityVertical?: boolean;
  highDensityHorizontal?: boolean;
  impl?: 'bitImageRaster' | 'graphics' | 'bitImageColumn';
  fragmentHeight?: number;
  center?: boolean;
}

/** NW7/CODABAR normalised lookup — strips non-alnum, uppercases */
const normaliseBarcodeName = (name: string): string =>
  name.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

const HW_BARCODE_NAMES: Record<string, string> = {};
for (const [ft, names] of Object.entries(BARCODE_TYPES)) {
  for (const name of Object.keys(names)) {
    HW_BARCODE_NAMES[normaliseBarcodeName(name)] = name;
  }
}

// Suppress unused variable warnings for imports used only in type positions or future methods
void (TabPosError);

export abstract class Escpos {
  protected readonly profile: PrinterProfile;
  protected readonly magic: MagicEncode;

  constructor(profileName?: string) {
    this.profile = ProfileManager.getProfile(profileName);
    this.magic = new MagicEncode((data) => this._raw(data), this.profile);
  }

  abstract _raw(data: Buffer): void;
  abstract open(): Promise<void>;
  abstract close(): Promise<void>;

  // ── Text ──────────────────────────────────────────────────────────────────

  text(txt: string): void {
    this.magic.write(txt);
  }

  textln(txt = ''): void {
    this.text(`${txt}\n`);
  }

  ln(count = 1): void {
    if (count < 0) throw new RangeError('count must be >= 0');
    if (count > 0) this.text('\n'.repeat(count));
  }

  blockText(txt: string, font: FontName = 'a', columns?: number): void {
    const cols = columns ?? this.profile.getColumns(font);
    this.text(wordWrap(txt, cols));
  }

  softwareColumns(
    textList: string[],
    widths: number | number[],
    align: Alignment | Alignment[],
  ): void {
    const n = textList.length;
    const widthArr = Array.isArray(widths) ? widths : [Math.round((widths as number) / n)];
    const resolvedWidths = repeatLast(widthArr, n);
    const alignArr = Array.isArray(align) ? align : [align];
    const resolvedAlign = repeatLast(alignArr, n);

    const wrapped = textList.map((t, i) => wordWrapLines(t, resolvedWidths[i]));
    const maxLen = Math.max(0, ...wrapped.map(w => w.length));
    for (let row = 0; row < maxLen; row++) {
      const line = textList.map((_, col) => {
        const cell = wrapped[col][row] ?? '';
        return padText(cell, resolvedWidths[col], resolvedAlign[col]);
      });
      this.textln(line.join(''));
    }
  }

  // ── Style ─────────────────────────────────────────────────────────────────

  set(opts: TextStyleOptions): void {
    const {
      customSize, doubleWidth, doubleHeight, normalTextSize,
      bold, underline, font, align, density, invert, smooth, flip,
      width, height,
    } = opts;

    if (customSize) {
      if (
        width !== undefined && height !== undefined &&
        width >= 1 && width <= 8 && height >= 1 && height <= 8
      ) {
        const sizeByte = TXT_STYLE.width[width] + TXT_STYLE.height[height];
        this._raw(Buffer.concat([TXT_SIZE, Buffer.from([sizeByte])]));
      } else {
        throw new SetVariableError('width and height must be 1-8 for customSize');
      }
    } else if (normalTextSize || doubleWidth || doubleHeight) {
      this._raw(TXT_NORMAL);
      if (doubleWidth && doubleHeight) this._raw(TXT_STYLE.size['2x']);
      else if (doubleWidth)            this._raw(TXT_STYLE.size['2w']);
      else if (doubleHeight)           this._raw(TXT_STYLE.size['2h']);
      else                             this._raw(TXT_STYLE.size.normal);
    }

    if (flip    !== undefined) this._raw(TXT_STYLE.flip[String(flip)    as 'true' | 'false']);
    if (smooth  !== undefined) this._raw(TXT_STYLE.smooth[String(smooth) as 'true' | 'false']);
    if (bold    !== undefined) this._raw(TXT_STYLE.bold[String(bold)    as 'true' | 'false']);
    if (underline !== undefined) this._raw(TXT_STYLE.underline[underline as 0 | 1 | 2]);
    if (font !== undefined) {
      const idx = this.profile.getFont(font);
      this._raw(setFont(Buffer.from([idx])));
    }
    if (align   !== undefined) this._raw(TXT_STYLE.align[align]);
    if (density !== undefined && density !== 9) {
      this._raw(TXT_STYLE.density[density as unknown as 0]);
    }
    if (invert  !== undefined) this._raw(TXT_STYLE.invert[String(invert) as 'true' | 'false']);
  }

  setWithDefault(opts: TextStyleOptions = {}): void {
    const merged: TextStyleOptions = {
      align: 'left',
      font: 'a',
      bold: false,
      underline: 0,
      width: 1,
      height: 1,
      density: 9,
      invert: false,
      smooth: false,
      flip: false,
      doubleWidth: false,
      doubleHeight: false,
      customSize: false,
      ...opts,
    };
    const { customSize, doubleWidth, doubleHeight } = merged;
    merged.normalTextSize = !customSize && !doubleWidth && !doubleHeight;
    this.set(merged);
  }

  lineSpacing(spacing?: number, divisor: 60 | 180 | 360 = 180): void {
    if (spacing === undefined) {
      this._raw(LINESPACING_RESET);
      return;
    }
    if (!(divisor in LINESPACING_FUNCS)) throw new RangeError('divisor must be 60, 180, or 360');
    if (divisor !== 60 && !(spacing >= 0 && spacing <= 255))
      throw new RangeError('spacing must be 0-255 for divisor 180/360');
    if (divisor === 60 && !(spacing >= 0 && spacing <= 85))
      throw new RangeError('spacing must be 0-85 for divisor 60');
    this._raw(Buffer.concat([LINESPACING_FUNCS[divisor], Buffer.from([spacing])]));
  }

  // ── Hardware ──────────────────────────────────────────────────────────────

  hw(action: 'INIT' | 'SELECT' | 'RESET'): void {
    const map: Record<string, Buffer> = {
      INIT: HW_INIT,
      SELECT: HW_SELECT,
      RESET: HW_RESET,
    };
    const cmd = map[action.toUpperCase()];
    if (!cmd) throw new Error(`Unknown hw action: ${action}`);
    this._raw(cmd);
  }

  cut(mode: 'FULL' | 'PART' = 'FULL', feed = true): void {
    if (!feed) {
      this._raw(Buffer.concat([GS, Buffer.from([0x56, 0x42, 0x00])]));
      return;
    }
    this.printAndFeed(6);
    const m = mode.toUpperCase();
    if (m !== 'FULL' && m !== 'PART') throw new Error("mode must be 'FULL' or 'PART'");
    if (m === 'PART') {
      this._raw(this.profile.supports('paperPartCut') ? PAPER_PART_CUT : PAPER_FULL_CUT);
    } else {
      this._raw(this.profile.supports('paperFullCut') ? PAPER_FULL_CUT : PAPER_PART_CUT);
    }
  }

  printAndFeed(lines: number): void {
    this._raw(Buffer.concat([ESC, Buffer.from('d'), Buffer.from([lines])]));
  }

  cashdraw(pin: number | number[]): void {
    if (pin === 2) { this._raw(CD_KICK_2); return; }
    if (pin === 5) { this._raw(CD_KICK_5); return; }
    if (Array.isArray(pin) && pin.length === 5) {
      this._raw(cashDrawerDecSequence(
        ...(pin as [number, number, number, number, number]),
      ));
      return;
    }
    throw new CashDrawerError(`Invalid pin: ${String(pin)}`);
  }

  // ── Barcode ───────────────────────────────────────────────────────────────

  static checkBarcode(bc: string, code: string): boolean {
    const fmt = BARCODE_FORMATS[bc];
    if (!fmt) return false;
    const [bounds, regex] = fmt;
    return (
      bounds.some(([min, max]) => code.length >= min && code.length <= max) &&
      regex.test(code)
    );
  }

  barcode(code: string, bc: string, opts: BarcodeOptions = {}): void {
    const {
      height = 64, width = 3, pos = 'BELOW', font = 'A',
      alignCenter = true, functionType, check = true,
    } = opts;

    const bcAlnum = normaliseBarcodeName(bc);
    const hwBc = HW_BARCODE_NAMES[bcAlnum];
    if (!hwBc) throw new BarcodeTypeError(`Not supported or unknown barcode: ${bc}`);

    const ftGuess =
      Object.entries(BARCODE_TYPES).find(([, names]) => hwBc in names)?.[0] ?? '';
    const ft = (functionType ?? ftGuess).toUpperCase() as 'A' | 'B';
    if (!ft || !BARCODE_TYPES[ft]) throw new BarcodeTypeError(`No function type for ${bc}`);

    if (check && !Escpos.checkBarcode(hwBc, code)) throw new BarcodeCodeError(code);

    if (alignCenter) this._raw(TXT_STYLE.align.center);
    if (height < 1 || height > 255) throw new BarcodeSizeError(`height=${height}`);
    if (width < 2 || width > 6)     throw new BarcodeSizeError(`width=${width}`);

    this._raw(Buffer.concat([BARCODE_HEIGHT, Buffer.from([height])]));
    this._raw(Buffer.concat([BARCODE_WIDTH,  Buffer.from([width])]));
    this._raw(font.toUpperCase() === 'B' ? BARCODE_FONT_B : BARCODE_FONT_A);

    const posMap: Record<string, Buffer> = {
      OFF:   BARCODE_TXT_OFF,
      ABOVE: BARCODE_TXT_ABV,
      BOTH:  BARCODE_TXT_BTH,
    };
    this._raw(posMap[pos.toUpperCase()] ?? BARCODE_TXT_BLW);

    this._raw(BARCODE_TYPES[ft][hwBc]);
    if (ft === 'B') this._raw(Buffer.from([code.length]));
    if (!code) throw new BarcodeCodeError();
    this._raw(Buffer.from(code, 'ascii'));
    if (ft === 'A') this._raw(NUL);
  }

  // ── QR ────────────────────────────────────────────────────────────────────

  async qr(content: string, opts: QrOptions = {}): Promise<void> {
    const {
      ec = QR_ECLEVEL_L, size = 3, model = QR_MODEL_2,
      native = false, center = false,
    } = opts;

    const validEc = [QR_ECLEVEL_L, QR_ECLEVEL_M, QR_ECLEVEL_Q, QR_ECLEVEL_H];
    if (!validEc.includes(ec)) throw new Error('Invalid error correction level');
    if (size < 1 || size > 16) throw new Error('size must be 1-16');
    if (![QR_MODEL_1, QR_MODEL_2, QR_MICRO].includes(model)) throw new Error('Invalid QR model');
    if (!content) return;

    if (!native) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore — QrHelper is implemented in Phase 4
      const { QrHelper } = await import('./qr/QrHelper');
      const img = await QrHelper.generate(content, { ec, size });
      await this.image(img, { center });
      return;
    }

    const cn = Buffer.from('1');
    this._send2dCodeData(Buffer.from([65]), cn, Buffer.from([48 + model, 0]));
    this._send2dCodeData(Buffer.from([67]), cn, Buffer.from([size]));
    this._send2dCodeData(Buffer.from([69]), cn, Buffer.from([48 + ec]));
    this._send2dCodeData(Buffer.from([80]), cn, Buffer.from(content, 'utf8'), Buffer.from('0'));
    this._send2dCodeData(Buffer.from([81]), cn, Buffer.alloc(0), Buffer.from('0'));
  }

  private _send2dCodeData(
    fn: Buffer,
    cn: Buffer,
    data: Buffer,
    m = Buffer.alloc(0),
  ): void {
    const header = intLowHigh(data.length + m.length + 2, 2);
    this._raw(Buffer.concat([GS, Buffer.from('(k'), header, cn, fn, m, data]));
  }

  // ── Image ─────────────────────────────────────────────────────────────────

  async image(source: string | Buffer, opts: ImageOptions = {}): Promise<void> {
    const {
      highDensityVertical = true,
      highDensityHorizontal = true,
      impl = 'bitImageRaster',
      fragmentHeight = 960,
      center = false,
    } = opts;

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore — EscposImage is implemented in Phase 4
    const { EscposImage } = await import('./image/EscposImage');
    const im = await EscposImage.load(source);

    try {
      const profileMedia = (this.profile.profileData as unknown as Record<string, unknown>)?.['media'];
      const maxWidthRaw =
        (profileMedia as Record<string, Record<string, number>> | undefined)
          ?.['width']?.['pixels'];
      const maxWidth = Number(maxWidthRaw);
      if (!isNaN(maxWidth)) {
        if (im.width > maxWidth) throw new ImageWidthError(`${im.width} > ${maxWidth}`);
        if (center) im.center(maxWidth);
      }
    } catch (e) {
      if (e instanceof ImageWidthError) throw e;
    }

    if (im.height > fragmentHeight) {
      for (const fragment of im.split(fragmentHeight)) {
        await this.image(fragment, { ...opts, center: false });
      }
      return;
    }

    if (impl === 'bitImageRaster') {
      const densityByte =
        (highDensityHorizontal ? 0 : 1) + (highDensityVertical ? 0 : 2);
      const header = Buffer.concat([
        GS, Buffer.from('v0'), Buffer.from([densityByte]),
        intLowHigh(im.widthBytes, 2), intLowHigh(im.height, 2),
      ]);
      this._raw(Buffer.concat([header, im.toRasterFormat()]));
    }

    if (impl === 'graphics') {
      const imgHeader = Buffer.concat([
        intLowHigh(im.width, 2), intLowHigh(im.height, 2),
      ]);
      const tone = Buffer.from('0');
      const colors = Buffer.from('1');
      const ym = Buffer.from([highDensityVertical   ? 0x01 : 0x02]);
      const xm = Buffer.from([highDensityHorizontal ? 0x01 : 0x02]);
      this._imageSendGraphicsData(
        Buffer.from('0'),
        Buffer.from('p'),
        Buffer.concat([tone, xm, ym, colors, imgHeader, im.toRasterFormat()]),
      );
      this._imageSendGraphicsData(Buffer.from('0'), Buffer.from('2'), Buffer.alloc(0));
    }

    if (impl === 'bitImageColumn') {
      const densityByte =
        (highDensityHorizontal ? 1 : 0) + (highDensityVertical ? 32 : 0);
      const header = Buffer.concat([
        ESC, Buffer.from('*'), Buffer.from([densityByte]), intLowHigh(im.width, 2),
      ]);
      const out: Buffer[] = [Buffer.concat([ESC, Buffer.from('3'), Buffer.from([16])])];
      for (const blob of im.toColumnFormat(highDensityVertical)) {
        out.push(Buffer.concat([header, blob, Buffer.from('\n')]));
      }
      out.push(Buffer.concat([ESC, Buffer.from('2')]));
      this._raw(Buffer.concat(out));
    }
  }

  private _imageSendGraphicsData(m: Buffer, fn: Buffer, data: Buffer): void {
    const header = intLowHigh(data.length + 2, 2);
    this._raw(Buffer.concat([GS, Buffer.from('(L'), header, m, fn, data]));
  }

  // ── Line display ──────────────────────────────────────────────────────────

  linedisplaySelect(select: boolean): void {
    this._raw(select ? LINE_DISPLAY_OPEN : LINE_DISPLAY_CLOSE);
  }

  linedisplayClear(): void {
    this._raw(LINE_DISPLAY_CLEAR);
  }

  linedisplay(text: string): void {
    this.linedisplaySelect(true);
    this.linedisplayClear();
    this.text(text);
    this.linedisplaySelect(false);
  }
}

// ── Utility helpers (module-private) ─────────────────────────────────────────

function wordWrap(text: string, width: number): string {
  return text
    .split(' ')
    .reduce((lines: string[], word: string) => {
      const last = lines[lines.length - 1];
      return last.length + word.length + 1 <= width
        ? [...lines.slice(0, -1), last ? `${last} ${word}` : word]
        : [...lines, word];
    }, [''])
    .join('\n');
}

function wordWrapLines(text: string, width: number): string[] {
  return wordWrap(text, width).split('\n');
}

function padText(text: string, width: number, align: Alignment): string {
  if (align === 'center') {
    return text.padStart(Math.floor((width + text.length) / 2)).padEnd(width);
  }
  if (align === 'right') return text.padStart(width);
  if (align === 'justify') {
    // Simple fallback — full justify is complex, return padEnd
    return text.padEnd(width);
  }
  return text.padEnd(width);
}

function repeatLast<T>(arr: T[], n: number): T[] {
  return Array.from({ length: n }, (_, i) => arr[Math.min(i, arr.length - 1)]);
}
