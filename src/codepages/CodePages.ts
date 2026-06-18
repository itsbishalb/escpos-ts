// src/codepages/CodePages.ts
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

export const CodePages = {
  getEncodingName(alias: string): string {
    return ALIAS_MAP[alias.toLowerCase()] ?? alias.toUpperCase();
  },

  getEncoding(name: string): CodePageEntry {
    const canonical = this.getEncodingName(name);
    const enc = capabilities.encodings[canonical];
    if (!enc) throw new Error(`Unknown code page: "${name}"`);
    return enc as CodePageEntry;
  },

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
      // Node.js Buffer does not support cp437-style code page names —
      // only latin1/utf8/ascii/hex/base64 are supported.
      console.warn(
        `[CodePages] Cannot decode python_encode "${enc.python_encode}" in Node.js; returning [].`
      );
      return [];
    }

    throw new LookupError(`Can't find a known encoding for ${encoding}`);
  },
};
