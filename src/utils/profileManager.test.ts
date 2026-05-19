import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

let sandboxDir: string;

/**
 * Helper that always re-requires ProfileManager to get fresh env-var-driven paths.
 * ProfileManager.resetInstance() clears the singleton; getProfilesDir/getActiveProfileFile
 * are functions (not constants), so they pick up CLAUDECODE_PROFILES_DIR at call time.
 */
function freshMod() {
  const { ProfileManager, getProfilesDir, getActiveProfileFile, PROFILE_ENV_VAR } = require('./profileManager.js') as typeof import('./profileManager.js');
  ProfileManager.resetInstance();
  return { ProfileManager, getProfilesDir, getActiveProfileFile, PROFILE_ENV_VAR };
}

describe('ProfileManager', () => {
  beforeEach(() => {
    sandboxDir = mkdtempSync(join(tmpdir(), 'profile-test-'));
    process.env.CLAUDECODE_PROFILES_DIR = join(sandboxDir, 'profiles');
    delete process.env.CLAUDECODE_PROFILE;
  });

  afterEach(() => {
    delete process.env.CLAUDECODE_PROFILES_DIR;
    delete process.env.CLAUDECODE_PROFILE;
    try {
      rmSync(sandboxDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  test('getInstance returns singleton', () => {
    const { ProfileManager } = freshMod();
    const a = ProfileManager.getInstance();
    const b = ProfileManager.getInstance();
    expect(a).toBe(b);
  });

  test('getActiveProfile returns null when no profile is active', () => {
    const { ProfileManager } = freshMod();
    const pm = ProfileManager.getInstance();
    expect(pm.getActiveProfile()).toBeNull();
  });

  test('getActiveProfile reads from env var', () => {
    process.env.CLAUDECODE_PROFILE = 'test-profile';
    const { ProfileManager } = freshMod();
    const pm = ProfileManager.getInstance();
    expect(pm.getActiveProfile()).toBe('test-profile');
  });

  test('getActiveProfile reads from active-profile file', () => {
    const { ProfileManager, getActiveProfileFile } = freshMod();

    // Create the active-profile file in the sandbox (auto-derived from PROFILES_DIR/..)
    mkdirSync(join(sandboxDir), { recursive: true });
    writeFileSync(getActiveProfileFile(), 'saved-profile', 'utf8');

    const pm = ProfileManager.getInstance();
    expect(pm.getActiveProfile()).toBe('saved-profile');
  });

  test('createProfile creates a profile directory with provider.json', () => {
    const { ProfileManager } = freshMod();
    const pm = ProfileManager.getInstance();

    pm.createProfile('work');

    const profileDir = pm.getProfileHomeDir('work');
    expect(existsSync(profileDir)).toBe(true);

    const providerConfig = JSON.parse(readFileSync(join(profileDir, 'provider.json'), 'utf8'));
    expect(providerConfig.provider).toBe('openai');
    expect(providerConfig.model).toBe('');
  });

  test('createProfile throws for duplicate name', () => {
    const { ProfileManager } = freshMod();
    const pm = ProfileManager.getInstance();

    pm.createProfile('work');
    expect(() => pm.createProfile('work')).toThrow('already exists');
  });

  test('createProfile throws for invalid name', () => {
    const { ProfileManager } = freshMod();
    const pm = ProfileManager.getInstance();

    expect(() => pm.createProfile('my profile')).toThrow('Profile name must contain');
    expect(() => pm.createProfile('profile/name')).toThrow('Profile name must contain');
  });

  test('createProfile accepts valid special characters', () => {
    const { ProfileManager } = freshMod();
    const pm = ProfileManager.getInstance();

    pm.createProfile('my-work_profile');
    expect(existsSync(pm.getProfileHomeDir('my-work_profile'))).toBe(true);
  });

  test('listProfiles returns empty when no profiles', () => {
    const { ProfileManager } = freshMod();
    const pm = ProfileManager.getInstance();

    expect(pm.listProfiles()).toEqual([]);
  });

  test('listProfiles returns created profiles sorted', () => {
    const { ProfileManager } = freshMod();
    const pm = ProfileManager.getInstance();

    pm.createProfile('z-profile');
    pm.createProfile('a-profile');
    pm.createProfile('m-profile');

    expect(pm.listProfiles()).toEqual(['a-profile', 'm-profile', 'z-profile']);
  });

  test('switchProfile changes active profile', () => {
    const { ProfileManager, getActiveProfileFile } = freshMod();
    const pm = ProfileManager.getInstance();

    pm.createProfile('work');
    pm.switchProfile('work');

    expect(pm.getActiveProfile()).toBe('work');

    const content = readFileSync(getActiveProfileFile(), 'utf8').trim();
    expect(content).toBe('work');
  });

  test('switchProfile throws for non-existent profile', () => {
    const { ProfileManager } = freshMod();
    const pm = ProfileManager.getInstance();

    expect(() => pm.switchProfile('nonexistent')).toThrow('does not exist');
  });

  test('switchProfile with null deactivates profile', () => {
    const { ProfileManager, getActiveProfileFile } = freshMod();
    const pm = ProfileManager.getInstance();

    pm.createProfile('work');
    pm.switchProfile('work');
    expect(pm.getActiveProfile()).toBe('work');

    pm.switchProfile(null);
    expect(pm.getActiveProfile()).toBeNull();

    const content = readFileSync(getActiveProfileFile(), 'utf8').trim();
    expect(content).toBe('');
  });

  test('deleteProfile removes profile directory', () => {
    const { ProfileManager } = freshMod();
    const pm = ProfileManager.getInstance();

    pm.createProfile('temp');
    expect(existsSync(pm.getProfileHomeDir('temp'))).toBe(true);

    pm.deleteProfile('temp');
    expect(existsSync(pm.getProfileHomeDir('temp'))).toBe(false);
    expect(pm.listProfiles()).toEqual([]);
  });

  test('deleteProfile throws for non-existent profile', () => {
    const { ProfileManager } = freshMod();
    const pm = ProfileManager.getInstance();

    expect(() => pm.deleteProfile('nonexistent')).toThrow('does not exist');
  });

  test('deleteProfile throws for active profile', () => {
    const { ProfileManager } = freshMod();
    process.env.CLAUDECODE_PROFILE = 'active-profile';

    const pm = ProfileManager.getInstance();
    pm.createProfile('active-profile');

    expect(() => pm.deleteProfile('active-profile')).toThrow('Cannot delete the active profile');
  });

  test('renameProfile renames profile directory', () => {
    const { ProfileManager } = freshMod();
    const pm = ProfileManager.getInstance();

    pm.createProfile('old-name');
    pm.renameProfile('old-name', 'new-name');

    expect(existsSync(pm.getProfileHomeDir('old-name'))).toBe(false);
    expect(existsSync(pm.getProfileHomeDir('new-name'))).toBe(true);
  });

  test('renameProfile updates active profile', () => {
    const { ProfileManager, getActiveProfileFile } = freshMod();
    const pm = ProfileManager.getInstance();

    pm.createProfile('old-name');
    pm.switchProfile('old-name');

    pm.renameProfile('old-name', 'new-name');
    expect(pm.getActiveProfile()).toBe('new-name');

    const content = readFileSync(getActiveProfileFile(), 'utf8').trim();
    expect(content).toBe('new-name');
  });

  test('renameProfile throws for non-existent source', () => {
    const { ProfileManager } = freshMod();
    const pm = ProfileManager.getInstance();

    expect(() => pm.renameProfile('nonexistent', 'new-name')).toThrow('does not exist');
  });

  test('renameProfile throws when target exists', () => {
    const { ProfileManager } = freshMod();
    const pm = ProfileManager.getInstance();

    pm.createProfile('a');
    pm.createProfile('b');

    expect(() => pm.renameProfile('a', 'b')).toThrow('already exists');
  });

  test('hasActiveProfile returns correct boolean', () => {
    const { ProfileManager } = freshMod();
    const pm = ProfileManager.getInstance();

    expect(pm.hasActiveProfile()).toBe(false);

    process.env.CLAUDECODE_PROFILE = 'test';
    expect(pm.hasActiveProfile()).toBe(true);
  });

  test('getProfileHomeDir returns correct path', () => {
    const { ProfileManager, getProfilesDir } = freshMod();
    const pm = ProfileManager.getInstance();

    expect(pm.getProfileHomeDir('test')).toBe(join(getProfilesDir(), 'test'));
  });

  test('PROFILE_ENV_VAR constant is correct', () => {
    const { PROFILE_ENV_VAR } = freshMod();
    expect(PROFILE_ENV_VAR).toBe('CLAUDECODE_PROFILE');
  });
});
