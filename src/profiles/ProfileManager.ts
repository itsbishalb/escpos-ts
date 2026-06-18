// src/profiles/ProfileManager.ts
import capabilitiesJson from './capabilities.json';
import type { CapabilitiesData, PrinterProfile, ProfileData } from './types';

const capabilities = capabilitiesJson as unknown as CapabilitiesData;

class ConcreteProfile implements PrinterProfile {
  constructor(public readonly profileData: ProfileData) {}

  supports(feature: string): boolean {
    return Boolean(this.profileData.features[feature]);
  }

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

  getColumns(font: 'a' | 'b'): number {
    const index = this.getFont(font);
    const fontData = this.profileData.fonts?.[String(index)];
    if (!fontData) throw new Error(`No columns data for font ${font}`);
    return fontData.columns;
  }

  getCodePages(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [indexStr, name] of Object.entries(this.profileData.codePages)) {
      result[name] = Number(indexStr);
    }
    return result;
  }
}

const profileCache = new Map<string, PrinterProfile>();

export const ProfileManager = {
  getProfile(name = 'default'): PrinterProfile {
    if (profileCache.has(name)) return profileCache.get(name)!;

    const profileData = capabilities.profiles[name];
    if (!profileData) throw new Error(`Unknown printer profile: "${name}"`);

    const profile = new ConcreteProfile(profileData);
    profileCache.set(name, profile);
    return profile;
  },

  listProfiles(): string[] {
    return Object.keys(capabilities.profiles);
  },
};
