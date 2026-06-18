// tests/codepages/CodePages.test.ts
import { CodePages } from '../../src/codepages/CodePages';

describe('CodePages', () => {
  test('getEncodingName returns canonical name for cp437', () => {
    const name = CodePages.getEncodingName('cp437');
    expect(typeof name).toBe('string');
    expect(name.length).toBeGreaterThan(0);
  });

  test('getEncoding returns an object with python_encode or data', () => {
    const enc = CodePages.getEncoding('CP437');
    expect(enc).toBeDefined();
    const hasData = 'python_encode' in enc || 'data' in enc;
    expect(hasData).toBe(true);
  });

  test('getEncoding throws for unknown name', () => {
    expect(() => CodePages.getEncoding('TOTALLY_FAKE_ENCODING')).toThrow();
  });

  test('getCodepageCharList returns empty array for python_encode encodings', () => {
    const chars = CodePages.getCodepageCharList('CP437');
    expect(Array.isArray(chars)).toBe(true);
    // CP437 has python_encode, not data — should return []
    expect(chars).toEqual([]);
  });

  test('getCodepageCharList returns 128 chars for data-based encoding', () => {
    // CP3011 has a data array in capabilities.json
    const chars = CodePages.getCodepageCharList('CP3011');
    expect(Array.isArray(chars)).toBe(true);
    expect(chars.length).toBe(128);
  });

  test('getEncodingName maps latin1 alias to ISO-8859-1', () => {
    const name = CodePages.getEncodingName('latin1');
    expect(name).toBe('ISO-8859-1');
  });

  test('getEncodingName maps pc437 alias to CP437', () => {
    const name = CodePages.getEncodingName('pc437');
    expect(name).toBe('CP437');
  });
});
