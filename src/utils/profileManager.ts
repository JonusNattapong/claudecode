import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

/**
 * Profiles directory: ~/.claude/profiles/
 * Uses CLAUDECODE_PROFILES_DIR env var override for testing.
 */
export function getProfilesDir(): string {
  return process.env.CLAUDECODE_PROFILES_DIR ?? join(homedir(), '.claude', 'profiles');
}

/**
 * File that stores the currently active profile name.
 * Uses CLAUDECODE_PROFILES_DIR env var override for testing.
 */
export function getActiveProfileFile(): string {
  return process.env.CLAUDECODE_PROFILES_DIR
    ? join(process.env.CLAUDECODE_PROFILES_DIR, '..', 'active-profile')
    : join(homedir(), '.claude', 'active-profile');
}

/**
 * Env var that overrides the active profile for a single session.
 */
export const PROFILE_ENV_VAR = 'CLAUDECODE_PROFILE';

export class ProfileManager {
  private static instance: ProfileManager | null = null;
  private activeProfile: string | null = null;

  static getInstance(): ProfileManager {
    if (!ProfileManager.instance) {
      ProfileManager.instance = new ProfileManager();
    }
    return ProfileManager.instance;
  }

  /** Reset singleton instance (for testing). */
  static resetInstance(): void {
    ProfileManager.instance = null;
  }

  /**
   * Resolve the active profile name.
   * Priority: env var > --profile flag (stored in env var) > active-profile file
   */
  getActiveProfile(): string | null {
    // Env var override (set by --profile flag in main.tsx action handler)
    const envProfile = process.env[PROFILE_ENV_VAR];
    if (envProfile) {
      return envProfile;
    }

    // Cached in-memory value (set by switchProfile)
    if (this.activeProfile) {
      return this.activeProfile;
    }

    // Read from persistent file
    try {
      const content = readFileSync(getActiveProfileFile(), 'utf8').trim();
      if (content) {
        this.activeProfile = content;
        return content;
      }
    } catch {
      // File doesn't exist or can't be read — no active profile
    }

    return null;
  }

  /**
   * Returns true if a profile is currently active.
   */
  hasActiveProfile(): boolean {
    return this.getActiveProfile() !== null;
  }

  /**
   * Switch the active profile. Writes the profile name to the active-profile file.
   * Pass null to deactivate (use default ~/.claude/ directly).
   */
  switchProfile(name: string | null): void {
    if (name === null) {
      // Deactivate profile
      this.activeProfile = null;
      try {
        writeFileSync(getActiveProfileFile(), '', 'utf8');
      } catch {
        // Ignore write errors
      }
      return;
    }

    // Validate profile exists
    const profileDir = this.getProfileHomeDir(name);
    if (!existsSync(profileDir)) {
      throw new Error(`Profile "${name}" does not exist. Create it with /profile create ${name}`);
    }

    this.activeProfile = name;
    try {
      // Ensure parent dir exists
      const parentDir = join(getActiveProfileFile(), '..');
      if (!existsSync(parentDir)) {
        mkdirSync(parentDir, { recursive: true });
      }
      writeFileSync(getActiveProfileFile(), name, 'utf8');
    } catch {
      // Ignore write errors — in-memory state is still updated
    }
  }

  /**
   * List all available profiles (directories under profiles dir).
   * Returns sorted alphabetically.
   */
  listProfiles(): string[] {
    try {
      return readdirSync(getProfilesDir(), { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name)
        .sort();
    } catch {
      return [];
    }
  }

  /**
   * Create a new profile with default configuration.
   */
  createProfile(name: string): void {
    const profileDir = this.getProfileHomeDir(name);
    if (existsSync(profileDir)) {
      throw new Error(`Profile "${name}" already exists.`);
    }

    // Validate name (alphanumeric, hyphens, underscores only)
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      throw new Error('Profile name must contain only letters, numbers, hyphens, and underscores.');
    }

    mkdirSync(profileDir, { recursive: true });

    // Create a default provider.json
    writeFileSync(
      join(profileDir, 'provider.json'),
      JSON.stringify(
        {
          provider: 'openai',
          model: '',
          providerConfig: {},
        },
        null,
        2,
      ),
      'utf8',
    );
  }

  /**
   * Delete a profile and all its contents.
   */
  deleteProfile(name: string): void {
    const profileDir = this.getProfileHomeDir(name);
    if (!existsSync(profileDir)) {
      throw new Error(`Profile "${name}" does not exist.`);
    }

    // Check we're not deleting the active profile
    if (this.getActiveProfile() === name) {
      throw new Error(`Cannot delete the active profile "${name}". Switch to another profile first.`);
    }

    rmSync(profileDir, { recursive: true, force: true });
  }

  /**
   * Rename a profile.
   */
  renameProfile(oldName: string, newName: string): void {
    const oldDir = this.getProfileHomeDir(oldName);
    const newDir = this.getProfileHomeDir(newName);

    if (!existsSync(oldDir)) {
      throw new Error(`Profile "${oldName}" does not exist.`);
    }
    if (existsSync(newDir)) {
      throw new Error(`Profile "${newName}" already exists.`);
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(newName)) {
      throw new Error('Profile name must contain only letters, numbers, hyphens, and underscores.');
    }

    renameSync(oldDir, newDir);

    // Update active profile file if the renamed profile was active
    if (this.getActiveProfile() === oldName) {
      this.switchProfile(newName);
    }
  }

  /**
   * Get the config home directory for a given profile.
   */
  getProfileHomeDir(name: string): string {
    return join(getProfilesDir(), name);
  }
}
