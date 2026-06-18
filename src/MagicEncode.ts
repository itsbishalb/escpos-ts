/**
 * @module escpos-ts/MagicEncode
 *
 * Automatic multi-encoding text encoder for ESC/POS printers.
 *
 * Translates UTF-8 strings into the correct ESC/POS byte sequences by
 * dynamically selecting the best matching code page for each character.
 * When characters in a string span multiple code pages, {@link MagicEncode}
 * emits the necessary `ESC t n` code-page-switch commands between segments.
 *
 * Based on the python-escpos `magicencode.py` module by Patrick Kanzler and
 * Frédéric van der Essen.
 */
import * as iconv from 'iconv-lite';
import { CODEPAGE_CHANGE } from './constants';
import { CodePages } from './codepages/CodePages';
import type { PrinterProfile } from './profiles/types';

type RawFn = (data: Buffer) => void;

/**
 * Automatic multi-encoding text encoder.
 *
 * Wraps a raw-bytes write function and a {@link PrinterProfile} to produce
 * correctly encoded ESC/POS byte streams for arbitrary Unicode text.
 *
 * **Auto mode (default):** Characters are grouped by the first code page in
 * the active printer profile that can represent them.  A `ESC t n` switch
 * command is emitted whenever the required code page changes.  ASCII
 * characters (< 128) are always emitted as-is without a code-page switch.
 *
 * **Forced mode:** Call {@link forceEncoding} to lock all output to a specific
 * code page.  Useful when the printer profile and document encoding are both
 * known in advance.
 *
 * @example
 * ```ts
 * // Used internally by Escpos — you rarely need to construct this directly.
 * const encoder = new MagicEncode(
 *   (buf) => printer._raw(buf),
 *   ProfileManager.getProfile('default'),
 * );
 * encoder.write('Hello, 世界!'); // auto-selects encodings per character
 * ```
 *
 * @since 1.0.0
 */
export class MagicEncode {
  private forcedEncoding: string | false = false;
  private currentEncoding: string | null = null;
  private readonly codepageMap: Record<string, number>; // name → printer index

  /**
   * @param raw     - Callback that writes a raw `Buffer` to the printer.
   *   Typically `(data) => this._raw(data)` from an {@link Escpos} subclass.
   * @param profile - Active printer profile; used to resolve the available
   *   code pages via {@link PrinterProfile.getCodePages}.
   */
  constructor(
    private readonly raw: RawFn,
    private readonly profile: PrinterProfile,
  ) {
    this.codepageMap = profile.getCodePages();
  }

  /**
   * Lock all subsequent output to a specific code page, bypassing auto-detection.
   *
   * Pass `false` to return to auto-detection mode.
   *
   * @param encoding - Canonical encoding name (e.g. `"CP437"`) to force, or
   *   `false` to re-enable automatic encoding selection.
   * @throws `Error` if `encoding` is a string not found in the capabilities database.
   * @since 1.0.0
   */
  forceEncoding(encoding: string | false): void {
    if (encoding !== false) {
      // Validate that the encoding is known
      CodePages.getEncoding(encoding);
    }
    this.forcedEncoding = encoding;
  }

  /**
   * Encode and write a UTF-8 string to the printer.
   *
   * In auto mode, the string is scanned character by character.  ASCII
   * characters are buffered as-is.  For non-ASCII characters, the method
   * searches the profile's available code pages for one that can represent
   * the character, emitting a code-page switch (`ESC t n`) if needed.
   *
   * In forced mode ({@link forceEncoding} was called with a string), the
   * entire string is encoded with that encoding.
   *
   * @param text - UTF-8 string to encode and send.
   * @since 1.0.0
   */
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
