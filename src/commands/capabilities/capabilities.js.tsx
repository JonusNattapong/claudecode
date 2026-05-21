import { Box, Text } from 'ink';
import * as React from 'react';
import { Dialog } from '../../components/design-system/Dialog.js';
import type { LocalJSXCommandCall } from '../../types/command.js';
import { detectCapabilities, formatCapabilitiesAsContext } from '../../utils/capabilities.js';

export const call: LocalJSXCommandCall = async onDone => {
  const capabilities = await detectCapabilities();
  const output = formatCapabilitiesAsContext(capabilities);

  return (
    <Dialog
      title="System Capabilities"
      onCancel={() => onDone('Capabilities dismissed', { display: 'system' })}
      inputGuide={() => <Text>Press Esc to close</Text>}
    >
      <Box flexDirection="column">
        <Text>This machine has the following tools and capabilities available:</Text>
        <Text> </Text>
        <Text>{output}</Text>
        <Text> </Text>
        <Text dimColor>
          This information is automatically prepended to conversation context, so Lulu knows what tools are available on
          this machine.
        </Text>
      </Box>
    </Dialog>
  );
};
