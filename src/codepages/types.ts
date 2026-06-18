/**
 * @module escpos-ts/codepages/types
 *
 * Type definitions for ESC/POS code-page (character encoding) entries stored
 * in the capabilities database.  Code pages map byte values 128–255 to
 * printable characters and are selected on the printer via the
 * `ESC t n` command ({@link CODEPAGE_CHANGE}).
 */

/**
 * A single code-page entry from the `capabilities.json` encodings table.
 *
 * Code pages define how byte values 128–255 map to printable characters for a
 * given ESC/POS printer.  The printer switches code pages with the
 * `ESC t n` command.  Two encoding strategies are supported:
 *
 * - **`data` array** — an explicit character table bundled in the capabilities
 *   database (eight strings of 16 chars each = 128 characters covering
 *   byte values 0x80–0xFF).
 * - **`python_encode` name** — an iconv-lite encoding name used at runtime
 *   to encode/decode characters on the fly.
 *
 * @since 1.0.0
 */
export interface CodePageEntry {
  /** Canonical encoding name (e.g. `"CP437"`, `"ISO-8859-1"`). */
  name: string;
  /**
   * iconv-lite encoding identifier used to encode or decode this code page
   * at runtime.  If absent, the `data` character table is used instead.
   *
   * @example `"cp437"`, `"iso-8859-1"`, `"cp850"`
   */
  python_encode?: string;
  /**
   * Explicit character map covering byte values 0x80–0xFF.
   *
   * Stored as an array of strings where each string contains exactly 16
   * characters.  The 8 strings together provide all 128 upper-range characters.
   * Used when iconv-lite does not support the encoding natively.
   */
  data?: string[];
  /** Freeform notes about encoding quirks or printer compatibility issues. */
  notes?: string;
}
