// tests/MagicEncode.test.ts
import { MagicEncode } from '../src/MagicEncode';
import { ProfileManager } from '../src/profiles/ProfileManager';

describe('MagicEncode', () => {
  function makeMagic(profile = ProfileManager.getProfile()) {
    const output: Buffer[] = [];
    const raw = (data: Buffer) => output.push(data);
    return { magic: new MagicEncode(raw, profile), output };
  }

  test('write() produces at least one buffer for ASCII text', () => {
    const { magic, output } = makeMagic();
    magic.write('Hello');
    expect(output.length).toBeGreaterThan(0);
  });

  test('write() encodes ASCII characters correctly', () => {
    const { magic, output } = makeMagic();
    magic.write('AB');
    const combined = Buffer.concat(output);
    // 'A' = 0x41, 'B' = 0x42
    expect(combined.includes(0x41)).toBe(true);
    expect(combined.includes(0x42)).toBe(true);
  });

  test('forceEncoding() to false enables auto mode', () => {
    const { magic } = makeMagic();
    expect(() => magic.forceEncoding(false)).not.toThrow();
  });

  test('forceEncoding() to CP437 forces that encoding without throwing', () => {
    const { magic, output } = makeMagic();
    expect(() => magic.forceEncoding('CP437')).not.toThrow();
    magic.write('Hello');
    expect(output.length).toBeGreaterThan(0);
  });

  test('CODEPAGE_CHANGE (ESC 0x74) is emitted when an encoding is set', () => {
    const { magic, output } = makeMagic();
    magic.write('Hello');
    const combined = Buffer.concat(output);
    // ESC = 0x1b, followed by 0x74
    const hasEsc74 = (() => {
      for (let i = 0; i < combined.length - 1; i++) {
        if (combined[i] === 0x1b && combined[i + 1] === 0x74) return true;
      }
      return false;
    })();
    expect(hasEsc74).toBe(true);
  });
});
