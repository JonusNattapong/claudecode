import * as React from 'react';
import { Box, Text } from '../../ink.js';
import { Spinner } from '../../components/Spinner.js';
import { clearSkillCaches } from '../../skills/loadSkillsDir.js';
import { clearPluginCommandCache, clearPluginSkillsCache } from '../../utils/plugins/loadPluginCommands.js';
import type { LocalJSXCommandCall } from '../../types/command.js';

type Props = {
  onDone: (result?: string) => void;
};

function ReloadSkills({ onDone }: Props): React.ReactNode {
  const [loading, setLoading] = React.useState(true);
  const [result, setResult] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function doReload() {
      try {
        clearSkillCaches();
        clearPluginSkillsCache();
        clearPluginCommandCache();
        if (!cancelled) {
          setResult('Skills cache cleared. Skills will be re-scanned on next command invocation.');
          setLoading(false);
        }
      } catch (error) {
        if (!cancelled) {
          setResult(`Error: ${(error as Error).message}`);
          setLoading(false);
        }
      }
    }

    doReload();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <Box flexDirection="row" gap={1} paddingY={1}>
        <Spinner color="permission" />
        <Text color="permission" bold>Clearing skill caches...</Text>
      </Box>
    );
  }

  return (
    <Box paddingY={1}>
      <Text>{result}</Text>
    </Box>
  );
}

export const call: LocalJSXCommandCall = async (onDone, _context) => {
  return <ReloadSkills onDone={onDone} />;
};
