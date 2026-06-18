// src/codepages/CodePages.ts
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
