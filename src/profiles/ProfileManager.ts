/**
 * @module escpos-ts/profiles/ProfileManager
 *
 * Registry and factory for {@link PrinterProfile} instances.
 *
 * Profiles are loaded from the bundled `capabilities.json` database and cached
 * for the lifetime of the process.  Pass a profile name to any printer
 * constructor or call {@link ProfileManager.getProfile} directly.
 */
import capabilitiesJson from './capabilities.json';
import type { CapabilitiesData, PrinterProfile, ProfileData } from './types';

const capabilities = capabilitiesJson as unknown as CapabilitiesData;

/**
 * Concrete runtime implementation of {@link PrinterProfile}.
 *
 * Wraps a raw {@link ProfileData} object (from `capabilities.json`) with
 * computed helper methods.  Created and cached internally by
 * {@link ProfileManager.getProfile} — do not instantiate directly.
 *
 * @internal
 */
class ConcreteProfile implements PrinterProfile {
  constructor(public readonly profileData: ProfileData) {}

  /**
   * Return whether the profile declares support for a named feature.
   *
   * @param feature - Feature key as it appears in `profileData.features`.
   * @returns `true` if the feature flag is `true` in the profile data.
   */
  supports(feature: string): boolean {
    return Boolean(this.profileData.features[feature]);
  }

  /**
   * Resolve a font name or numeric index to a validated font index.
   *
   * @param font - `"a"`, `"b"`, or a numeric index.
   * @returns Numeric index (0 = Font A, 1 = Font B).
   * @throws `Error` if the font is not defined in the active profile.
   */
  getFont(font: string | number): number {
    const fontMap: Record<string, number> = { a: 0, b: 1 };
    const index =
      typeof font === 'string'
        ? (fontMap[font] ?? Number(font))
        : font;
    if (!this.profileData.fonts || !(String(index) in this.profileData.fonts)) {
      throw new Error(`"${font}" is not a valid font in the current profile`);
    }
    return index;
  }

  /**
   * Return the column count for a named font as declared in the profile.
   *
   * @param font - `"a"` or `"b"`.
   * @returns Number of printable columns.
   * @throws `Error` if the font has no column data in the active profile.
   */
  getColumns(font: 'a' | 'b'): number {
    const index = this.getFont(font);
    const fontData = this.profileData.fonts?.[String(index)];
    if (!fontData) throw new Error(`No columns data for font ${font}`);
    return fontData.columns;
  }

  /**
   * Return the inverted code-page map (name → ESC/POS index).
   *
   * The raw profile stores `{ index: name }`; this method flips it to
   * `{ name: index }` for use by {@link MagicEncode}.
   *
   * @returns `Record<name, index>`, e.g. `{ "CP437": 0, "CP850": 2 }`.
   */
  getCodePages(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [indexStr, name] of Object.entries(this.profileData.codePages)) {
      result[name] = Number(indexStr);
    }
    return result;
  }
}

const profileCache = new Map<string, PrinterProfile>();

/**
 * Registry for looking up and caching {@link PrinterProfile} instances.
 *
 * Profiles are sourced from the bundled `capabilities.json` database.
 * Resolved profiles are cached in memory — repeated calls with the same name
 * return the identical object reference.
 *
 * @example
 * ```ts
 * import { ProfileManager } from 'escpos-ts';
 *
 * const profiles = ProfileManager.listProfiles();
 * // ['default', 'TM-T88V', 'POS-58', ...]
 *
 * const profile = ProfileManager.getProfile('TM-T88V');
 * console.log(profile.getColumns('a')); // 42
 * ```
 *
 * @since 1.0.0
 */
export const ProfileManager = {
  /**
   * Retrieve a {@link PrinterProfile} by name.
   *
   * Profiles are cached after the first load — subsequent calls with the same
   * name return the cached instance without re-reading the database.
   *
   * @param name - Profile name as it appears in `capabilities.json`
   *   (e.g. `"default"`, `"TM-T88V"`).  Defaults to `"default"`.
   * @returns The resolved {@link PrinterProfile} instance.
   * @throws `Error` if the named profile does not exist in the database.
   * @since 1.0.0
   */
  getProfile(name = 'default'): PrinterProfile {
    if (profileCache.has(name)) return profileCache.get(name)!;

    const profileData = capabilities.profiles[name];
    if (!profileData) throw new Error(`Unknown printer profile: "${name}"`);

    const profile = new ConcreteProfile(profileData);
    profileCache.set(name, profile);
    return profile;
  },

  /**
   * List all profile names available in the bundled `capabilities.json`.
   *
   * @returns Array of profile name strings.
   * @since 1.0.0
   */
  listProfiles(): string[] {
    return Object.keys(capabilities.profiles);
  },
};
