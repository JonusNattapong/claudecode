import * as React from 'react';
import { clearCommandsCache } from '../../commands.js';
import type { LocalJSXCommandCall, LocalJSXCommandOnDone } from '../../types/command.js';
import { Box, Text } from '../../ink.js';
import { Spinner } from '../../components/Spinner.js';

type Props = {
  onDone: LocalJSXCommandOnDone;
};

function ReloadSkills({ onDone }: Props): React.ReactNode {
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    try {
      clearCommandsCache();
    } catch (error) {
      onDone(`Error reloading skills: ${(error as Error).message}`);
      return;
    }
    setLoading(false);
    onDone();
  }, [onDone]);

  if (loading) {
    return (
      <Box flexDirection="row" gap={1} paddingY={1}>
        <Spinner color="permission" />
        <Text color="permission" bold>
          Reloading skills...
        </Text>
      </Box>
    );
  }

  return (
    <Box paddingY={1}>
      <Text color="permission" bold>
        Skills re-scanned successfully. New and changed skills are now available.
      </Text>
    </Box>
  );
}

export const call: LocalJSXCommandCall = async onDone => {
  return <ReloadSkills onDone={onDone} />;
};
