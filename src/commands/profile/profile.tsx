import chalk from 'chalk';
import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import type { CommandResultDisplay } from '../../commands.js';
import { Box, Text, useInput } from '../../ink.js';
import type { LocalJSXCommandCall, LocalJSXCommandOnDone } from '../../types/command.js';
import { ProfileManager } from '../../utils/profileManager.js';

const pm = ProfileManager.getInstance();

/**
 * Interactive profile manager. Arrow keys to navigate, Enter to switch, q to quit.
 */
function ProfilePicker({ onDone }: { onDone: LocalJSXCommandOnDone }): React.ReactNode {
  const profiles = useMemo(() => pm.listProfiles(), []);
  const activeProfile = pm.getActiveProfile();
  const [cursor, setCursor] = useState(0);
  const [mode, setMode] = useState<'list' | 'delete' | 'rename'>('list');
  const [message, setMessage] = useState<string | null>(null);

  useInput(
    useCallback(
      (
        input: string,
        key: {
          upArrow?: boolean;
          downArrow?: boolean;
          return?: boolean;
          escape?: boolean;
          delete?: boolean;
          r?: boolean;
        },
      ) => {
        if (mode === 'delete') {
          setMode('list');
          return;
        }
        if (mode === 'rename') {
          setMode('list');
          return;
        }

        if (key.escape || input === 'q') {
          onDone(undefined, { display: 'skip' });
          return;
        }

        if (key.upArrow) {
          setCursor(prev => (prev > 0 ? prev - 1 : profiles.length - 1));
          return;
        }

        if (key.downArrow) {
          setCursor(prev => (prev < profiles.length - 1 ? prev + 1 : 0));
          return;
        }

        if (key.return) {
          const selected = profiles[cursor];
          if (!selected) return;
          try {
            pm.switchProfile(selected);
            setMessage(`Switched to "${selected}"`);
            setTimeout(() => onDone(`Switched to profile "${selected}"`, { display: 'system' }), 800);
          } catch (err) {
            setMessage(`Error: ${(err as Error).message}`);
          }
          return;
        }

        if (input === 'd') {
          const selected = profiles[cursor];
          if (!selected || selected === activeProfile) {
            setMessage('Cannot delete active profile');
            return;
          }
          try {
            pm.deleteProfile(selected);
            setMessage(`Deleted "${selected}"`);
            // Force re-render by updating state — profiles will be stale but
            // we navigate away so it's fine.
            setTimeout(() => onDone(`Deleted profile "${selected}"`, { display: 'system' }), 800);
          } catch (err) {
            setMessage(`Error: ${(err as Error).message}`);
          }
          return;
        }

        if (input === 'r') {
          setMessage('Rename via: /profile rename <old> <new>');
          setTimeout(() => setMessage(null), 2000);
          return;
        }
      },
      [profiles, cursor, activeProfile, mode, onDone],
    ),
  );

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold>Profiles</Text>
        <Text dimColor> (↑↓·Enter switch · d delete · r rename · q quit)</Text>
      </Box>
      {profiles.map((profile, i) => {
        const isActive = profile === activeProfile;
        const isCursor = i === cursor;
        return (
          <Box key={profile} marginLeft={1}>
            <Text bold={isActive || isCursor}>
              {isCursor ? '❯' : ' '} {i + 1}. {profile}
              {isActive ? ' (active)' : ''}
            </Text>
          </Box>
        );
      })}
      {profiles.length === 0 && (
        <Box marginLeft={1}>
          <Text dimColor>No profiles yet.</Text>
        </Box>
      )}
      {message && (
        <Box marginTop={1}>
          <Text>{message}</Text>
        </Box>
      )}
    </Box>
  );
}

export const call: LocalJSXCommandCall = async (onDone, _context, args) => {
  const trimmed = args?.trim() ?? '';
  const parts = trimmed.split(/\s+/).filter(Boolean);

  if (parts.length > 0) {
    await handleCommand(parts, onDone);
    return null;
  }

  return <ProfilePicker onDone={onDone} />;
};

async function handleCommand(args: string[], onDone: LocalJSXCommandOnDone): Promise<void> {
  const subcommand = args[0]?.toLowerCase();
  const name = args[1];
  const name2 = args[2];

  switch (subcommand) {
    case 'switch':
    case 'use': {
      if (!name) {
        onDone('Usage: /profile switch <name>', { display: 'system' });
        return;
      }
      try {
        pm.switchProfile(name);
        onDone(`Switched to profile "${name}".\n${chalk.dim('Changes take effect on next session start.')}`, {
          display: 'system',
        });
      } catch (err) {
        onDone(chalk.red(`Error: ${(err as Error).message}`), { display: 'system' });
      }
      return;
    }
    case 'create': {
      if (!name) {
        onDone('Usage: /profile create <name>', { display: 'system' });
        return;
      }
      try {
        pm.createProfile(name);
        onDone(`Profile "${name}" created.\n${chalk.dim(`Switch: /profile switch ${name}`)}`, { display: 'system' });
      } catch (err) {
        onDone(chalk.red(`Error: ${(err as Error).message}`), { display: 'system' });
      }
      return;
    }
    case 'delete':
    case 'rm': {
      if (!name) {
        onDone('Usage: /profile delete <name>', { display: 'system' });
        return;
      }
      try {
        pm.deleteProfile(name);
        onDone(`Profile "${name}" deleted.`, { display: 'system' });
      } catch (err) {
        onDone(chalk.red(`Error: ${(err as Error).message}`), { display: 'system' });
      }
      return;
    }
    case 'rename':
    case 'mv': {
      if (!name || !name2) {
        onDone('Usage: /profile rename <old> <new>', { display: 'system' });
        return;
      }
      try {
        pm.renameProfile(name, name2);
        onDone(`Profile renamed from "${name}" to "${name2}".`, { display: 'system' });
      } catch (err) {
        onDone(chalk.red(`Error: ${(err as Error).message}`), { display: 'system' });
      }
      return;
    }
    case 'current': {
      const active = pm.getActiveProfile();
      onDone(active ? `Active profile: ${active}` : 'No active profile.', { display: 'system' });
      return;
    }
    case 'list':
    case 'ls':
    default: {
      const list = pm.listProfiles();
      if (list.length === 0) {
        onDone('No profiles.', { display: 'system' });
        return;
      }
      const active = pm.getActiveProfile();
      let out = '';
      for (const p of list) {
        out += `${p === active ? '● ' : '  '}${p}${p === active ? ' (active)' : ''}\n`;
      }
      onDone(out, { display: 'system' });
    }
  }
}
