import type React from 'react';
import { Box, Text, useTheme } from 'src/ink.js';
import { useTerminalSize } from '../../hooks/useTerminalSize.js';
import { useAppState } from '../../state/AppState.js';
import { AGENT_COLOR_TO_THEME_COLOR, AGENT_COLORS } from '../../tools/AgentTool/agentColorManager.js';
import { env } from '../../utils/env.js';

const WELCOME_V2_WIDTH = 58;

export function WelcomeV2(): React.ReactNode {
  const [theme] = useTheme();
  const standaloneAgentContext = useAppState(s => s.standaloneAgentContext);
  const standaloneColor = standaloneAgentContext?.color;
  const activeColor =
    standaloneColor && AGENT_COLORS.includes(standaloneColor)
      ? AGENT_COLOR_TO_THEME_COLOR[standaloneColor]
      : 'autoAccept';

  const isLegacyWindows =
    env.platform === 'win32' &&
    !['windows-terminal', 'vscode', 'cursor', 'windsurf', 'antigravity'].includes(env.terminal ?? '');

  if (isLegacyWindows) {
    return <LegacyWindowsWelcomeV2 theme={theme} welcomeMessage="Welcome to Claude Code" />;
  }

  if (env.terminal === 'Apple_Terminal') {
    return <AppleTerminalWelcomeV2 theme={theme} welcomeMessage="Welcome to Claude Code" />;
  }

  const isLightTheme = ['light', 'light-daltonized', 'light-ansi'].includes(theme);

  if (isLightTheme) {
    const t0 = (
      <Text>
        <Text color={activeColor}>{'Welcome to Claude Code'} </Text>
        <Text dimColor={true}>v{MACRO.VERSION} </Text>
      </Text>
    );
    const t1 = <Text>{'…'.repeat(WELCOME_V2_WIDTH)}</Text>;
    const t2 = <Text>{' '.repeat(WELCOME_V2_WIDTH)}</Text>;
    const t3 = <Text>{' '.repeat(WELCOME_V2_WIDTH)}</Text>;
    const t4 = <Text>{' '.repeat(WELCOME_V2_WIDTH)}</Text>;
    const t5 = <Text>{'            ░░░░░░                                        '}</Text>;
    const t6 = <Text>{'    ░░░   ░░░░░░░░░░                                      '}</Text>;
    const t7 = <Text>{'   ░░░░░░░░░░░░░░░░░░░                                    '}</Text>;
    const t8 = <Text>{' '.repeat(WELCOME_V2_WIDTH)}</Text>;
    const t9 = (
      <Text>
        <Text dimColor={true}>{'                           ░░░░'}</Text>
        <Text>{'                     ██    '}</Text>
      </Text>
    );
    const t10 = (
      <Text>
        <Text dimColor={true}>{'                         ░░░░░░░░░░'}</Text>
        <Text>{'               ██▒▒██  '}</Text>
      </Text>
    );
    const t11 = <Text>{'                                            ▒▒      ██   ▒'}</Text>;

    // Horns row!
    const tHorn = (
      <Text>
        {'      '}
        <Text color="clawd_body"> ▗ ▖ </Text>
        {'                                    '}
      </Text>
    );

    // Head top row
    const t12 = (
      <Text>
        {'      '}
        <Text color="clawd_body"> █████████ </Text>
        {'                         ▒▒░░▒▒      ▒ ▒▒  '}
      </Text>
    );

    // Eye row - now with clawd_eye background!
    const t13 = (
      <Text>
        {'      '}
        <Text color="clawd_body" backgroundColor="clawd_eye">
          ██▄█████▄██
        </Text>
        {'                           ▒▒         ▒▒   '}
      </Text>
    );

    // Head bottom row
    const t14 = (
      <Text>
        {'      '}
        <Text color="clawd_body"> █████████ </Text>
        {'                          ░          ▒     '}
      </Text>
    );

    // Tentacles row
    const tTentacles = (
      <Text>
        {'……'}
        <Text color="clawd_body">{'█ █   █ █'}</Text>
        {'……………………………………░………………▒…………'}
      </Text>
    );

    return (
      <Box width={WELCOME_V2_WIDTH} flexDirection="column">
        {t0}
        {t1}
        {t2}
        {t3}
        {t4}
        {t5}
        {t6}
        {t7}
        {t8}
        {t9}
        {t10}
        {t11}
        {tHorn}
        {t12}
        {t13}
        {t14}
        {tTentacles}
      </Box>
    );
  }

  // Dark theme scene
  const t0 = (
    <Text>
      <Text color={activeColor}>{'Welcome to Claude Code'} </Text>
      <Text dimColor={true}>v{MACRO.VERSION} </Text>
    </Text>
  );
  const t1 = <Text>{'…'.repeat(WELCOME_V2_WIDTH)}</Text>;
  const t2 = <Text>{' '.repeat(WELCOME_V2_WIDTH)}</Text>;
  const t3 = <Text>{'     *                                       █████▓▓░     '}</Text>;
  const t4 = <Text>{'                                 *         ███▓░     ░░   '}</Text>;
  const t5 = <Text>{'            ░░░░░░                        ███▓░           '}</Text>;
  const t6 = <Text>{'    ░░░   ░░░░░░░░░░                      ███▓░           '}</Text>;
  const t7 = (
    <Text>
      <Text>{'   ░░░░░░░░░░░░░░░░░░░    '}</Text>
      <Text bold={true}>*</Text>
      <Text>{'                ██▓░░      ▓   '}</Text>
    </Text>
  );
  const t8 = <Text>{'                                             ░▓▓███▓▓░    '}</Text>;
  const t9 = <Text dimColor={true}>{' *                                 ░░░░                   '}</Text>;
  const t10 = <Text dimColor={true}>{'                                 ░░░░░░░░                 '}</Text>;
  const t11 = <Text dimColor={true}>{'                               ░░░░░░░░░░░░░░░░           '}</Text>;

  // Horns row!
  const tHorn = (
    <Text>
      {'      '}
      <Text color="clawd_body"> ▗ ▖ </Text>
      {'                                    '}
    </Text>
  );

  // Head top row
  const t12 = <Text color="clawd_body"> █████████ </Text>;
  const t13 = (
    <Text>
      {'      '}
      {t12}
      {'                                       '}
      <Text dimColor={true}>*</Text>
      <Text> </Text>
    </Text>
  );

  // Eye row - now with clawd_eye background!
  const t14 = (
    <Text>
      {'      '}
      <Text color="clawd_body" backgroundColor="clawd_eye">
        ██▄█████▄██
      </Text>
      <Text>{'                        '}</Text>
      <Text bold={true}>*</Text>
      <Text>{'                '}</Text>
    </Text>
  );

  // Head bottom row
  const t15 = (
    <Text>
      {'      '}
      <Text color="clawd_body"> █████████ </Text>
      {'     *                                   '}
    </Text>
  );

  // Tentacles row
  const tTentacles = (
    <Text>
      {'……'}
      <Text color="clawd_body">{'█ █   █ █'}</Text>
      {'…………………………………………………………………………'}
    </Text>
  );

  return (
    <Box width={WELCOME_V2_WIDTH} flexDirection="column">
      {t0}
      {t1}
      {t2}
      {t3}
      {t4}
      {t5}
      {t6}
      {t7}
      {t8}
      {t9}
      {t10}
      {t11}
      {tHorn}
      {t13}
      {t14}
      {t15}
      {tTentacles}
    </Box>
  );
}

type AppleTerminalWelcomeV2Props = {
  theme: string;
  welcomeMessage: string;
};

function AppleTerminalWelcomeV2({ theme, welcomeMessage }: AppleTerminalWelcomeV2Props): React.ReactNode {
  const isLightTheme = ['light', 'light-daltonized', 'light-ansi'].includes(theme);
  const standaloneAgentContext = useAppState(s => s.standaloneAgentContext);
  const standaloneColor = standaloneAgentContext?.color;
  const activeColor =
    standaloneColor && AGENT_COLORS.includes(standaloneColor)
      ? AGENT_COLOR_TO_THEME_COLOR[standaloneColor]
      : 'autoAccept';

  const t0 = (
    <Text>
      <Text color={activeColor}>{welcomeMessage} </Text>
      <Text dimColor={true}>v{MACRO.VERSION} </Text>
    </Text>
  );

  const tHorn = (
    <Text>
      {'      '}
      <Text color="clawd_body"> ▗ ▖ </Text>
      {'                                    '}
    </Text>
  );

  if (isLightTheme) {
    const t4 = <Text>{'…'.repeat(WELCOME_V2_WIDTH)}</Text>;
    const t5 = <Text>{' '.repeat(WELCOME_V2_WIDTH)}</Text>;
    const t6 = <Text>{' '.repeat(WELCOME_V2_WIDTH)}</Text>;
    const t7 = <Text>{' '.repeat(WELCOME_V2_WIDTH)}</Text>;
    const t8 = <Text>{'            ░░░░░░                                        '}</Text>;
    const t9 = <Text>{'    ░░░   ░░░░░░░░░░                                      '}</Text>;
    const t10 = <Text>{'   ░░░░░░░░░░░░░░░░░░░                                    '}</Text>;
    const t11 = <Text>{' '.repeat(WELCOME_V2_WIDTH)}</Text>;
    const t12 = (
      <Text>
        <Text dimColor={true}>{'                           ░░░░'}</Text>
        <Text>{'                     ██    '}</Text>
      </Text>
    );
    const t13 = (
      <Text>
        <Text dimColor={true}>{'                         ░░░░░░░░░░'}</Text>
        <Text>{'               ██▒▒██  '}</Text>
      </Text>
    );
    const t14 = <Text>{'                                            ▒▒      ██   ▒'}</Text>;
    const t15 = <Text>{'                                          ▒▒░░▒▒      ▒ ▒▒  '}</Text>;

    // Eye row for Apple Terminal
    const t16 = (
      <Text>
        {'      '}
        <Text color="clawd_body">▗</Text>
        <Text color="clawd_eye" backgroundColor="clawd_body">
          {' '}
          ▗{'     '}▖{' '}
        </Text>
        <Text color="clawd_body">▖</Text>
        {'                           ▒▒         ▒▒ '}
      </Text>
    );

    const t17 = (
      <Text>
        {'       '}
        <Text backgroundColor="clawd_body">{' '.repeat(9)}</Text>
        {'                           ░          ▒   '}
      </Text>
    );

    const t18 = (
      <Text>
        {'……'}
        <Text backgroundColor="clawd_body"> </Text>
        <Text> </Text>
        <Text backgroundColor="clawd_body"> </Text>
        <Text>{'   '}</Text>
        <Text backgroundColor="clawd_body"> </Text>
        <Text> </Text>
        <Text backgroundColor="clawd_body"> </Text>
        {'……………………………………░………………▒…………'}
      </Text>
    );

    return (
      <Box width={WELCOME_V2_WIDTH} flexDirection="column">
        {t0}
        {t4}
        {t5}
        {t6}
        {t7}
        {t8}
        {t9}
        {t10}
        {t11}
        {t12}
        {t13}
        {t14}
        {t15}
        {tHorn}
        {t16}
        {t17}
        {t18}
      </Box>
    );
  }

  // Apple Terminal Dark mode
  const t4 = <Text>{'…'.repeat(WELCOME_V2_WIDTH)}</Text>;
  const t5 = <Text>{' '.repeat(WELCOME_V2_WIDTH)}</Text>;
  const t6 = <Text>{'     *                                       █████▓▓░     '}</Text>;
  const t7 = <Text>{'                                 *         ███▓░     ░░   '}</Text>;
  const t8 = <Text>{'            ░░░░░░                        ███▓░           '}</Text>;
  const t9 = <Text>{'    ░░░   ░░░░░░░░░░                      ███▓░           '}</Text>;
  const t10 = (
    <Text>
      <Text>{'   ░░░░░░░░░░░░░░░░░░░    '}</Text>
      <Text bold={true}>*</Text>
      <Text>{'                ██▓░░      ▓   '}</Text>
    </Text>
  );
  const t11 = <Text>{'                                             ░▓▓███▓▓░    '}</Text>;
  const t12 = <Text dimColor={true}>{' *                                 ░░░░                   '}</Text>;
  const t13 = <Text dimColor={true}>{'                                 ░░░░░░░░                 '}</Text>;
  const t14 = <Text dimColor={true}>{'                               ░░░░░░░░░░░░░░░░           '}</Text>;
  const t15 = (
    <Text>
      {'                                                      '}
      <Text dimColor={true}>*</Text>
      <Text> </Text>
    </Text>
  );

  const t16 = (
    <Text>
      {'        '}
      <Text color="clawd_body">▗</Text>
      <Text color="clawd_eye" backgroundColor="clawd_body">
        {' '}
        ▗{'     '}▖{' '}
      </Text>
      <Text color="clawd_body">▖</Text>
      <Text>{'                       '}</Text>
      <Text bold={true}>*</Text>
      <Text>{'                '}</Text>
    </Text>
  );

  const t17 = (
    <Text>
      {'        '}
      <Text backgroundColor="clawd_body">{' '.repeat(9)}</Text>
      {'      *                                   '}
    </Text>
  );

  const t18 = (
    <Text>
      {'……'}
      <Text backgroundColor="clawd_body"> </Text>
      <Text> </Text>
      <Text backgroundColor="clawd_body"> </Text>
      <Text>{'   '}</Text>
      <Text backgroundColor="clawd_body"> </Text>
      <Text> </Text>
      <Text backgroundColor="clawd_body"> </Text>
      {'…………………………………………………………………………'}
    </Text>
  );

  return (
    <Box width={WELCOME_V2_WIDTH} flexDirection="column">
      {t0}
      {t4}
      {t5}
      {t6}
      {t7}
      {t8}
      {t9}
      {t10}
      {t11}
      {t12}
      {t13}
      {t14}
      {t15}
      {tHorn}
      {t16}
      {t17}
      {t18}
    </Box>
  );
}

function LegacyWindowsWelcomeV2({ theme, welcomeMessage }: AppleTerminalWelcomeV2Props): React.ReactNode {
  const { columns } = useTerminalSize();
  const isLightTheme = ['light', 'light-daltonized', 'light-ansi'].includes(theme);
  const standaloneAgentContext = useAppState(s => s.standaloneAgentContext);
  const standaloneColor = standaloneAgentContext?.color;
  const activeColor =
    standaloneColor && AGENT_COLORS.includes(standaloneColor)
      ? AGENT_COLOR_TO_THEME_COLOR[standaloneColor]
      : 'autoAccept';

  // Max width we can print without wrapping (subtract 4 for safety padding)
  const maxSafeWidth = columns ? Math.max(10, columns - 4) : WELCOME_V2_WIDTH;

  // Helper to safely truncate/pad a string to prevent wrapping
  const fitLine = (str: string) => {
    let trimmed = str.trimEnd();
    // Replace double-width/problematic characters to safe, highly-compatible standard ASCII characters
    trimmed = trimmed.replaceAll('…', '.').replaceAll('░', '.').replaceAll('▒', '.').replaceAll('▓', '.');

    if (trimmed.length > maxSafeWidth) {
      return trimmed.slice(0, maxSafeWidth);
    }
    return trimmed;
  };

  // Welcome row
  const t0 = (
    <Text>
      <Text color={activeColor}>{welcomeMessage} </Text>
      <Text dimColor={true}>v{MACRO.VERSION} </Text>
    </Text>
  );

  // Separator row
  const t1 = <Text>{fitLine('.'.repeat(WELCOME_V2_WIDTH))}</Text>;

  // Scene lines (clouds and stars)
  let sceneLines: string[];
  if (isLightTheme) {
    sceneLines = [
      '            ......',
      '    ...   ..........',
      '   ...................',
      '                           ....',
      '                     ██',
      '                         ..........',
      '               ██..██',
      '                                            ..      ██   .',
      '                                          ......      . ..',
    ];
  } else {
    sceneLines = [
      '     *                                       █████....',
      '                                 *         ███..     ..',
      '            ......                        ███..',
      '    ...   ..........                      ███..',
      '   ...................    *',
      '                                             ..█████...',
      ' *                                 ....',
      '                                 ........',
      '                               ..........',
    ];
  }

  // Now let's draw the mascot
  // Horns
  const tHorn = <Text color="clawd_body">{'       ^ ^'}</Text>;

  // Head top
  const tHeadTop = (
    <Text>
      <Text color="clawd_body">{'      ███████'}</Text>
      {isLightTheme ? (
        <Text>{fitLine('                         ..........      . ..').slice(13)}</Text>
      ) : (
        <Text>{fitLine('                                       * ').slice(13)}</Text>
      )}
    </Text>
  );

  // Eyes row
  const tEyes = (
    <Text>
      <Text color="clawd_body">{'      ██'}</Text>
      <Text color="clawd_eye">{'█'}</Text>
      <Text color="clawd_body">{'██'}</Text>
      <Text color="clawd_eye">{'█'}</Text>
      <Text color="clawd_body">{'██'}</Text>
      {isLightTheme ? (
        <Text>{fitLine('                           ..         .. ').slice(15)}</Text>
      ) : (
        <Text>{fitLine('                        *                ').slice(15)}</Text>
      )}
    </Text>
  );

  // Head bottom
  const tHeadBottom = (
    <Text>
      <Text color="clawd_body">{'      ███████'}</Text>
      {isLightTheme ? (
        <Text>{fitLine('                          .          .     ').slice(13)}</Text>
      ) : (
        <Text>{fitLine('     *                                   ').slice(13)}</Text>
      )}
    </Text>
  );

  // Feet/Tentacles
  const tFeet = (
    <Text>
      <Text>{'      '}</Text>
      <Text color="clawd_body">{'^ ^   ^ ^'}</Text>
      {isLightTheme ? (
        <Text>
          {fitLine('……………………………………░………………▒…………')
            .slice(15)
            .replaceAll('…', '.')
            .replaceAll('░', '.')
            .replaceAll('▒', '.')}
        </Text>
      ) : (
        <Text>{fitLine('…………………………………………………………………………').slice(15).replaceAll('…', '.')}</Text>
      )}
    </Text>
  );

  return (
    <Box flexDirection="column">
      {t0}
      {t1}
      <Text>{sceneLines.map(fitLine).join('\n')}</Text>
      {tHorn}
      {tHeadTop}
      {tEyes}
      {tHeadBottom}
      {tFeet}
    </Box>
  );
}
