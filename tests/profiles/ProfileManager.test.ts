// tests/profiles/ProfileManager.test.ts
import { ProfileManager } from '../../src/profiles/ProfileManager';

describe('ProfileManager', () => {
  test('getProfile() without name returns default profile', () => {
    const p = ProfileManager.getProfile();
    expect(p).toBeDefined();
    expect(p.profileData.name).toBeDefined();
  });

  test('getProfile("default") returns a valid profile', () => {
    const p = ProfileManager.getProfile('default');
    expect(p.profileData).toBeDefined();
  });

  test('unknown profile name throws', () => {
    expect(() => ProfileManager.getProfile('nonexistent-xyz')).toThrow();
  });

  test('supports() returns boolean', () => {
    const p = ProfileManager.getProfile('default');
    expect(typeof p.supports('paperFullCut')).toBe('boolean');
  });

  test('getColumns() returns a number for font a', () => {
    const p = ProfileManager.getProfile('default');
    expect(typeof p.getColumns('a')).toBe('number');
  });

  test('getCodePages() returns a name→index map', () => {
    const p = ProfileManager.getProfile('default');
    const pages = p.getCodePages();
    expect(typeof Object.values(pages)[0]).toBe('number');
  });
});
