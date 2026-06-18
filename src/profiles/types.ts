/**
 * @module escpos-ts/profiles/types
 *
 * TypeScript type definitions for the printer profiles / capabilities system.
 * Profiles describe hardware-specific constraints such as column widths,
 * supported code pages, and optional features (paper cut, cash drawer, etc.).
 * The raw data lives in `capabilities.json`; {@link PrinterProfile} is the
 * runtime interface that wraps it with computed helper methods.
 */

/**
 * Column and character-cell dimension data for a single printer font.
 *
 * Most ESC/POS printers expose two fonts — Font A (index 0) and Font B
 * (index 1) — each with a different column count and optional character-cell
 * dimensions in dots.
 *
 * @since 1.0.0
 */
export interface FontProfile {
  /** Maximum number of characters that fit on one printed line using this font. */
  columns: number;
  /** Character cell height in dots (optional; used for custom line spacing). */
  charV?: number;
  /** Character cell width in dots (optional). */
  charH?: number;
}

/**
 * Print-media width expressed in both physical (mm) and raster (pixels) units.
 *
 * The `'Unknown'` sentinel is used when the value is not specified in the
 * capabilities database and cannot be assumed.
 *
 * @since 1.0.0
 */
export interface MediaWidth {
  /** Physical paper width in millimetres, or `'Unknown'` if not specified. */
  mm: number | 'Unknown';
  /**
   * Printable area width in pixels at the printer's native DPI, or
   * `'Unknown'` if not specified.  This value governs image centering in
   * {@link Escpos.image}.
   */
  pixels: number | 'Unknown';
}

/**
 * Physical print-media characteristics declared by a printer profile.
 *
 * @since 1.0.0
 */
export interface MediaProfile {
  /** Print-area width in both mm and pixels; see {@link MediaWidth}. */
  width: MediaWidth;
  /** Print resolution in dots-per-inch (optional). */
  dpi?: number;
}

/**
 * Raw profile data as stored in `capabilities.json`.
 *
 * This is the serialised form loaded from disk.  {@link PrinterProfile} wraps
 * it with computed helper methods used by the {@link Escpos} base class.
 * Obtain a `ProfileData` via `profile.profileData` on any {@link PrinterProfile}.
 *
 * @since 1.0.0
 */
export interface ProfileData {
  /** Human-readable profile name (e.g. `"Epson TM-T88V"`). */
  name: string;
  /** Optional freeform notes about the printer model or known quirks. */
  notes?: string;
  /**
   * Map of ESC/POS code-page index (as string key) to encoding name.
   * Example: `{ "0": "CP437", "2": "CP850" }`.
   */
  codePages: Record<string, string>;
  /**
   * Feature flags indicating which ESC/POS capabilities the printer supports.
   * Example: `{ "paperFullCut": true, "paperPartCut": false }`.
   */
  features: Record<string, boolean>;
  /**
   * Per-font column and dimension data, keyed by font index as a string.
   * Example: `{ "0": { "columns": 42 }, "1": { "columns": 56 } }`.
   */
  fonts?: Record<string, FontProfile>;
  /** Physical media characteristics such as paper width. */
  media?: MediaProfile;
}

/**
 * Top-level shape of the `capabilities.json` printer capabilities database.
 *
 * The database is bundled with the library and contains profiles for common
 * ESC/POS printers as well as a full encoding table for code-page management.
 *
 * @since 1.0.0
 */
export interface CapabilitiesData {
  /** All known printer profiles, keyed by profile name (e.g. `"default"`, `"TM-T88V"`). */
  profiles: Record<string, ProfileData>;
  /**
   * All known ESC/POS code-page encodings, keyed by canonical name
   * (e.g. `"CP437"`, `"ISO-8859-1"`).
   */
  encodings: Record<string, { name: string; notes?: string; python_encode?: string; data?: string[] }>;
}

/**
 * Runtime interface for a resolved printer profile.
 *
 * Wraps {@link ProfileData} with computed helper methods used throughout the
 * {@link Escpos} base class for column-width negotiation, font selection, and
 * code-page management.
 *
 * Obtain an instance via {@link ProfileManager.getProfile}.
 *
 * @example
 * ```ts
 * import { ProfileManager } from 'escpos-ts';
 *
 * const profile = ProfileManager.getProfile('TM-T88V');
 * console.log(profile.getColumns('a')); // 42
 * console.log(profile.supports('paperFullCut')); // true
 * ```
 *
 * @since 1.0.0
 */
export interface PrinterProfile {
  /** The raw profile data object loaded from `capabilities.json`. */
  readonly profileData: ProfileData;

  /**
   * Return whether the profile declares support for a named feature.
   *
   * @param feature - Feature key as it appears in `profileData.features`,
   *   e.g. `"paperFullCut"`, `"paperPartCut"`, `"cashDrawer"`.
   * @returns `true` if the feature flag is explicitly set to `true`.
   */
  supports(feature: string): boolean;

  /**
   * Resolve a font name or index to a validated numeric font index.
   *
   * @param font - Font identifier: `"a"`, `"b"`, or a numeric index.
   * @returns Numeric font index (0 = Font A, 1 = Font B).
   * @throws `Error` if the font is not defined in the current profile.
   */
  getFont(font: string | number): number;

  /**
   * Return the number of printable columns for a named font.
   *
   * Used by {@link Escpos.blockText} to word-wrap text to the correct width.
   *
   * @param font - `"a"` for Font A or `"b"` for Font B.
   * @returns Column count for the specified font.
   * @throws `Error` if no column data is available for the font.
   */
  getColumns(font: 'a' | 'b'): number;

  /**
   * Return the inverted code-page map for this profile.
   *
   * The returned object maps encoding names to their ESC/POS index, which is
   * the opposite of the raw `profileData.codePages` map (index → name).
   *
   * @returns `Record<name, index>`, e.g. `{ "CP437": 0, "CP850": 2 }`.
   */
  getCodePages(): Record<string, number>;
}
