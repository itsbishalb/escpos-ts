// src/MagicEncode.ts
import * as iconv from 'iconv-lite';
import { CODEPAGE_CHANGE } from './constants';
import { CodePages } from './codepages/CodePages';
import type { PrinterProfile } from './profiles/types';

type RawFn = (data: Buffer) => void;

export class MagicEncode {
  private forcedEncoding: string | false = false;
  private currentEncoding: string | null = null;
  private readonly codepageMap: Record<string, number>; // name → printer index

  constructor(
    private readonly raw: RawFn,
    private readonly profile: PrinterProfile,
  ) {
    this.codepageMap = profile.getCodePages();
  }

  forceEncoding(encoding: string | false): void {
    if (encoding !== false) {
      // Validate that the encoding is known
      CodePages.getEncoding(encoding);
    }
    this.forcedEncoding = encoding;
  }

  write(text: string): void {
    if (this.forcedEncoding !== false) {
      this._setEncoding(this.forcedEncoding);
      this.raw(this._encodeString(text, this.forcedEncoding));
      return;
    }

    // Auto mode: group characters by the encoding that can represent them
    let buf: number[] = [];
    let encoding = this.currentEncoding ?? this._pickDefaultEncoding();

    for (const char of text) {
      const code = char.charCodeAt(0);
      if (code < 128) {
        // ASCII — any encoding works; stay with the current one
        buf.push(code);
      } else {
        // Non-ASCII — find an encoding that can represent this char
        const charEncoding = this._findEncodingForChar(char);
        const target = charEncoding ?? encoding;
        if (target !== encoding) {
          if (buf.length) this._flushBuffer(buf);
          buf = [];
          encoding = target;
          this._setEncoding(encoding);
        }
        buf.push(this._encodeChar(char, encoding));
      }
    }

    if (buf.length > 0) {
      this._setEncoding(encoding);
      this._flushBuffer(buf);
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private _flushBuffer(codes: number[]): void {
    this.raw(Buffer.from(codes));
  }

  private _setEncoding(encoding: string): void {
    if (encoding === this.currentEncoding) return;
    const index = this.codepageMap[encoding];
    if (index === undefined) return;
    this.raw(Buffer.concat([CODEPAGE_CHANGE, Buffer.from([index])]));
    this.currentEncoding = encoding;
  }

  /** Pick the first available encoding from the profile (prefer CP437). */
  private _pickDefaultEncoding(): string {
    const keys = Object.keys(this.codepageMap);
    return keys.find(k => k === 'CP437') ?? keys.find(k => k.startsWith('CP4')) ?? keys[0] ?? 'CP437';
  }

  /** Return the first profile encoding whose char list contains `char`. */
  private _findEncodingForChar(char: string): string | null {
    for (const enc of Object.keys(this.codepageMap)) {
      try {
        const charList = CodePages.getCodepageCharList(enc);
        if (charList.includes(char)) return enc;
      } catch {
        // Skip encodings that cannot be decoded
      }
    }
    return null;
  }

  /** Encode a single character as a byte in the given encoding. */
  private _encodeChar(char: string, encoding: string): number {
    const code = char.charCodeAt(0);
    if (code < 128) return code;
    try {
      const charList = CodePages.getCodepageCharList(encoding);
      const idx = charList.indexOf(char);
      if (idx !== -1) return idx + 128;
    } catch {
      // fall through to '?'
    }
    return 63; // '?'
  }

  /** Encode an entire string using iconv-lite if available, else ASCII fallback. */
  private _encodeString(text: string, encoding: string): Buffer {
    try {
      const enc = CodePages.getEncoding(encoding);
      const icovEnc = enc.python_encode ?? encoding.toLowerCase();
      if (iconv.encodingExists(icovEnc)) {
        return iconv.encode(text, icovEnc);
      }
    } catch {
      // fall through
    }
    return Buffer.from(text, 'ascii');
  }
}
