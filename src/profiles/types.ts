// src/profiles/types.ts

export interface FontProfile {
  columns: number;
  charV?: number;
  charH?: number;
}

export interface MediaWidth {
  mm: number | 'Unknown';
  pixels: number | 'Unknown';
}

export interface MediaProfile {
  width: MediaWidth;
  dpi?: number;
}

export interface ProfileData {
  name: string;
  notes?: string;
  codePages: Record<string, string>;   // index → name
  features: Record<string, boolean>;
  fonts?: Record<string, FontProfile>;
  media?: MediaProfile;
}

export interface CapabilitiesData {
  profiles: Record<string, ProfileData>;
  encodings: Record<string, { name: string; notes?: string; python_encode?: string; data?: string[] }>;
}

export interface PrinterProfile {
  readonly profileData: ProfileData;
  supports(feature: string): boolean;
  getFont(font: string | number): number;
  getColumns(font: 'a' | 'b'): number;
  getCodePages(): Record<string, number>;  // name → index
}
