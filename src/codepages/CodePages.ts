/**
 * @module escpos-ts/codepages/CodePages
 *
 * Utilities for resolving and decoding ESC/POS code pages (character
 * encodings).  Used internally by {@link MagicEncode} to build the character
 * lookup tables needed for automatic encoding selection.
 *
 * Code pages define how byte values 128–255 map to printable characters.
 * The printer switches between them via the `ESC t n` (`{@link CODEPAGE_CHANGE}`)
 * command.
 */
import * as iconv from 'iconv-lite';
import capabilitiesJson from '../profiles/capabilities.json';
import type { CapabilitiesData } from '../profiles/types';
import type { CodePageEntry } from './types';

const capabilities = capabilitiesJson as unknown as CapabilitiesData;

const ALIAS_MAP: Record<string, string> = {
  cp437: 'CP437',
  pc437: 'CP437',
  cp850: 'CP850',
  pc850: 'CP850',
  cp860: 'CP860',
  cp863: 'CP863',
  cp865: 'CP865',
  latin1: 'ISO-8859-1',
  'iso-8859-1': 'ISO-8859-1',
};

class LookupError extends Error {}

/**
 * Code-page resolver and character-table builder.
 *
 * Resolves encoding aliases, looks up encoding metadata from `capabilities.json`,
 * and builds the 128-character lookup table (byte values 0x80–0xFF) for any
 * supported code page.
 *
 * @example
 * ```ts
 * import { CodePages } from 'escpos-ts';
 *
 * const canonical = CodePages.getEncodingName('pc437'); // 'CP437'
 * const chars = CodePages.getCodepageCharList('CP437'); // string[128]
 * ```
 *
 * @since 1.0.0
 */
export const CodePages = {
  /**
   * Resolve an encoding alias to its canonical name.
   *
   * Handles common variants such as `"pc437"` → `"CP437"`,
   * `"latin1"` → `"ISO-8859-1"`.  Unrecognised inputs are returned
   * uppercased without modification.
   *
   * @param alias - Encoding name or alias (case-insensitive).
   * @returns Canonical encoding name as used in `capabilities.json`.
   * @since 1.0.0
   */
  getEncodingName(alias: string): string {
    return ALIAS_MAP[alias.toLowerCase()] ?? alias.toUpperCase();
  },

  /**
   * Retrieve the {@link CodePageEntry} for a given encoding name or alias.
   *
   * @param name - Encoding name or alias (e.g. `"CP437"`, `"pc850"`).
   * @returns The matching {@link CodePageEntry} from the capabilities database.
   * @throws `Error` if the encoding is not found in the database.
   * @since 1.0.0
   */
  getEncoding(name: string): CodePageEntry {
    const canonical = this.getEncodingName(name);
    const enc = capabilities.encodings[canonical];
    if (!enc) throw new Error(`Unknown code page: "${name}"`);
    return enc as CodePageEntry;
  },

  /**
   * Build the 128-character lookup table for byte values 0x80–0xFF in a
   * given code page.
   *
   * Two strategies are tried in order:
   *  1. **`data` array** — use the explicit character table bundled in
   *     `capabilities.json` (each entry covers 16 characters; 8 entries total).
   *  2. **iconv-lite** — decode each byte 128–255 using the `python_encode`
   *     name via `iconv-lite` (requires the encoding to be supported).
   *
   * @param encoding - Encoding name or alias (e.g. `"CP437"`).
   * @returns Array of 128 single-character strings covering bytes 0x80–0xFF.
   * @throws `LookupError` if neither strategy succeeds for the encoding.
   * @since 1.0.0
   */
  getCodepageCharList(encoding: string): string[] {
    const enc = this.getEncoding(encoding);

    if (enc.data) {
      // data is an array of strings, each 16 chars wide (8 rows × 16 = 128 chars)
      const chars = enc.data.join('').split('');
      if (chars.length !== 128) {
        throw new LookupError(`Code page data for ${encoding} is not 128 chars (got ${chars.length})`);
      }
      return chars;
    }

    if (enc.python_encode) {
      if (!iconv.encodingExists(enc.python_encode)) {
        throw new LookupError(`iconv-lite does not support encoding "${enc.python_encode}"`);
      }
      const chars: string[] = [];
      for (let i = 128; i < 256; i++) {
        chars.push(iconv.decode(Buffer.from([i]), enc.python_encode));
      }
      return chars;
    }

    throw new LookupError(`Can't find a known encoding for ${encoding}`);
  },
};
