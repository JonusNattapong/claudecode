import type { UUID } from 'crypto';
import type * as React from 'react';
import { useState } from 'react';
import { getSessionId } from '../../bootstrap/state.js';
import { Select } from '../../components/CustomSelect/index.js';
import { Dialog } from '../../components/design-system/Dialog.js';
import { Divider } from '../../components/design-system/Divider.js';
import { Tab, Tabs } from '../../components/design-system/Tabs.js';
import { Clawd } from '../../components/LogoV2/Clawd.js';
import { Box, Text, useInput } from '../../ink.js';
import { useSetAppState } from '../../state/AppState.js';
import type { ToolUseContext } from '../../Tool.js';
import { AGENT_COLORS, type AgentColorName } from '../../tools/AgentTool/agentColorManager.js';
import type { LocalJSXCommandContext, LocalJSXCommandOnDone } from '../../types/command.js';
import { getGlobalConfig, saveGlobalConfig } from '../../utils/config.js';
import { getTranscriptPath, saveAgentColor } from '../../utils/sessionStorage.js';
import { isTeammate } from '../../utils/teammate.js';

const RESET_ALIASES = ['default', 'reset', 'none', 'gray', 'grey'] as const;

const CLAWD_BODY_COLORS = [
  { label: 'Purple', value: 'clawd_body' },
  { label: 'Magenta', value: 'ansi:magenta' },
  { label: 'Cyan', value: 'ansi:cyan' },
  { label: 'Gold', value: 'ansi:yellow' },
  { label: 'Red', value: 'ansi:red' },
  { label: 'Green', value: 'ansi:green' },
  { label: 'Blue', value: 'ansi:blue' },
  { label: 'Orange', value: 'ansi:yellowBright' },
  { label: 'Pink', value: 'ansi:magentaBright' },
  { label: 'White', value: 'ansi:white' },
  { label: 'Gray', value: 'ansi:blackBright' },
] as const;

const CLAWD_EYE_COLORS = [
  { label: 'Red', value: 'clawd_eye' },
  { label: 'Yellow', value: 'ansi:yellow' },
  { label: 'Green', value: 'ansi:green' },
  { label: 'Blue', value: 'ansi:blue' },
  { label: 'Cyan', value: 'ansi:cyan' },
  { label: 'White', value: 'ansi:white' },
  { label: 'Orange', value: 'ansi:yellowBright' },
  { label: 'Pink', value: 'ansi:magentaBright' },
] as const;

const SESSION_COLORS = [
  { label: 'Default (reset to theme default)', value: 'default' as const },
  { label: 'Red', value: 'red' as const },
  { label: 'Blue', value: 'blue' as const },
  { label: 'Green', value: 'green' as const },
  { label: 'Yellow', value: 'yellow' as const },
  { label: 'Purple', value: 'purple' as const },
  { label: 'Orange', value: 'orange' as const },
  { label: 'Pink', value: 'pink' as const },
  { label: 'Cyan', value: 'cyan' as const },
];

const SPINNER_COLORS = [
  { label: 'Default (autoAccept)', value: 'default' as const },
  { label: 'Purple', value: 'autoAccept' as const },
  { label: 'Red', value: 'red' as const },
  { label: 'Blue', value: 'blue' as const },
  { label: 'Green', value: 'green' as const },
  { label: 'Yellow', value: 'yellow' as const },
  { label: 'Cyan', value: 'cyan' as const },
  { label: 'Pink', value: 'pink' as const },
  { label: 'Orange', value: 'orange' as const },
  { label: 'White', value: 'white' as const },
];

// ─── Interactive Color Panel ─────────────────────────────────────────────────

function ColorPanel({
  onDone,
  initialColorSetting,
}: {
  onDone: LocalJSXCommandOnDone;
  initialColorSetting: AgentColorName | 'default';
}) {
  const setAppState = useSetAppState();
  const config = getGlobalConfig();
  const [selectedTab, setSelectedTab] = useState('prompt');

  // Clawd colors
  const [bodyColor, setBodyColor] = useState<string>((config as any).clawdBodyColor ?? 'clawd_body');
  const [eyeColor, setEyeColor] = useState<string>((config as any).clawdEyeColor ?? 'clawd_eye');
  const [showHorns, setShowHorns] = useState<boolean>((config as any).showClawdHorns ?? true);
  // Spinner color
  const [spinnerColor, setSpinnerColor] = useState<string>((config as any).spinnerColor ?? 'default');
  // Focused pane within mascot tab: 'body' | 'eyes' | 'horns'
  const [mascotPane, setMascotPane] = useState<'body' | 'eyes' | 'horns'>('body');
  const [focusedBodyIdx, setFocusedBodyIdx] = useState(
    CLAWD_BODY_COLORS.findIndex(c => c.value === ((config as any).clawdBodyColor ?? 'clawd_body')),
  );
  const [focusedEyeIdx, setFocusedEyeIdx] = useState(
    CLAWD_EYE_COLORS.findIndex(c => c.value === ((config as any).clawdEyeColor ?? 'clawd_eye')),
  );

  const handleCancel = () => {
    setAppState(prev => ({
      ...prev,
      standaloneAgentContext: {
        ...prev.standaloneAgentContext,
        name: prev.standaloneAgentContext?.name ?? '',
        color: initialColorSetting === 'default' ? undefined : (initialColorSetting as AgentColorName),
      },
    }));
    onDone('Color picker dismissed', { display: 'system' });
  };

  // Keyboard navigation for mascot tab
  useInput(
    (input, key) => {
      if (selectedTab !== 'mascot') return;

      if (key.tab) {
        setMascotPane(p => {
          if (p === 'body') return 'eyes';
          if (p === 'eyes') return 'horns';
          return 'body';
        });
        return;
      }

      if (mascotPane === 'body') {
        if (key.upArrow) {
          setFocusedBodyIdx(i => {
            const next = i <= 0 ? CLAWD_BODY_COLORS.length - 1 : i - 1;
            setBodyColor(CLAWD_BODY_COLORS[next]!.value);
            return next;
          });
          return;
        }
        if (key.downArrow) {
          setFocusedBodyIdx(i => {
            const next = i >= CLAWD_BODY_COLORS.length - 1 ? 0 : i + 1;
            setBodyColor(CLAWD_BODY_COLORS[next]!.value);
            return next;
          });
          return;
        }
        // Enter saves body color
        if (key.return) {
          saveGlobalConfig(prev => ({ ...prev, clawdBodyColor: bodyColor }));
          return;
        }
      }

      if (mascotPane === 'eyes') {
        if (key.upArrow) {
          setFocusedEyeIdx(i => {
            const next = i <= 0 ? CLAWD_EYE_COLORS.length - 1 : i - 1;
            setEyeColor(CLAWD_EYE_COLORS[next]!.value);
            return next;
          });
          return;
        }
        if (key.downArrow) {
          setFocusedEyeIdx(i => {
            const next = i >= CLAWD_EYE_COLORS.length - 1 ? 0 : i + 1;
            setEyeColor(CLAWD_EYE_COLORS[next]!.value);
            return next;
          });
          return;
        }
        if (key.return) {
          saveGlobalConfig(prev => ({ ...prev, clawdEyeColor: eyeColor }));
          return;
        }
      }

      if (mascotPane === 'horns') {
        if (key.return || key.leftArrow || key.rightArrow || key.upArrow || key.downArrow || input === ' ') {
          setShowHorns(h => {
            const next = !h;
            saveGlobalConfig(prev => ({ ...prev, showClawdHorns: next }));
            return next;
          });
          return;
        }
      }
    },
    { isActive: true },
  );

  return (
    <Dialog
      title="Color & Customization"
      subtitle="Prompt bar · Spinner · Clawd mascot colors"
      onCancel={handleCancel}
      hideInputGuide
    >
      <Tabs selectedTab={selectedTab} onTabChange={setSelectedTab} defaultTab="prompt" useFullWidth navFromContent>
        <Tab title="Prompt Bar" id="prompt">
          <Box flexDirection="column" gap={1} marginTop={1}>
            <Select
              options={SESSION_COLORS}
              onFocus={setting => {
                setAppState(prev => ({
                  ...prev,
                  standaloneAgentContext: {
                    ...prev.standaloneAgentContext,
                    name: prev.standaloneAgentContext?.name ?? '',
                    color: setting === 'default' ? undefined : (setting as AgentColorName),
                  },
                }));
              }}
              onChange={async (value: string) => {
                const colorValue = value === 'default' ? 'default' : (value as AgentColorName);
                const sessionId = getSessionId() as UUID;
                const fullPath = getTranscriptPath();
                await saveAgentColor(sessionId, colorValue, fullPath);

                setAppState(prev => ({
                  ...prev,
                  standaloneAgentContext: {
                    ...prev.standaloneAgentContext,
                    name: prev.standaloneAgentContext?.name ?? '',
                    color: value === 'default' ? undefined : (value as AgentColorName),
                  },
                }));

                onDone(value === 'default' ? 'Session color reset to default' : `Session color set to: ${value}`);
              }}
              onCancel={handleCancel}
              visibleOptionCount={SESSION_COLORS.length}
              defaultValue={initialColorSetting}
              defaultFocusValue={initialColorSetting}
            />
          </Box>
        </Tab>

        <Tab title="Spinner" id="spinner">
          <Box flexDirection="column" gap={1} marginTop={1}>
            <Select
              options={SPINNER_COLORS}
              onFocus={setting => {
                setSpinnerColor(setting);
                saveGlobalConfig(prev => ({ ...prev, spinnerColor: setting === 'default' ? undefined : setting }));
              }}
              onChange={async (value: string) => {
                saveGlobalConfig(prev => ({ ...prev, spinnerColor: value === 'default' ? undefined : value }));
                onDone(value === 'default' ? 'Spinner color reset to default' : `Spinner color set to: ${value}`);
              }}
              onCancel={handleCancel}
              visibleOptionCount={SPINNER_COLORS.length}
              defaultValue={spinnerColor}
              defaultFocusValue={spinnerColor}
            />
          </Box>
        </Tab>

        <Tab title="Mascot" id="mascot">
          <Box flexDirection="column" gap={1} marginTop={1}>
            {/* Clawd Preview */}
            <Box flexDirection="column" alignItems="center">
              <Clawd pose="default" showHorns={showHorns} bodyColor={bodyColor} eyeColor={eyeColor} />
              <Text dimColor italic marginTop={0}>
                Live preview
              </Text>
            </Box>

            <Divider />

            {/* Body Color Selection */}
            <Box flexDirection="column" gap={0}>
              <Text bold color={mascotPane === 'body' ? 'suggestion' : undefined}>
                {mascotPane === 'body' ? '▸ ' : '  '}Body Color
              </Text>
              {CLAWD_BODY_COLORS.map((c, idx) => (
                <Box key={c.value} marginLeft={2}>
                  <Text
                    bold={idx === focusedBodyIdx && mascotPane === 'body'}
                    color={idx === focusedBodyIdx && mascotPane === 'body' ? 'suggestion' : undefined}
                  >
                    {idx === focusedBodyIdx ? '> ' : '  '}
                    {c.label}
                    {idx === focusedBodyIdx && bodyColor === c.value ? '  ◄' : ''}
                  </Text>
                </Box>
              ))}
            </Box>

            <Divider />

            {/* Eye Color Selection */}
            <Box flexDirection="column" gap={0}>
              <Text bold color={mascotPane === 'eyes' ? 'suggestion' : undefined}>
                {mascotPane === 'eyes' ? '▸ ' : '  '}Eye Color
              </Text>
              {CLAWD_EYE_COLORS.map((c, idx) => (
                <Box key={c.value} marginLeft={2}>
                  <Text
                    bold={idx === focusedEyeIdx && mascotPane === 'eyes'}
                    color={idx === focusedEyeIdx && mascotPane === 'eyes' ? 'suggestion' : undefined}
                  >
                    {idx === focusedEyeIdx ? '> ' : '  '}
                    {c.label}
                    {idx === focusedEyeIdx && eyeColor === c.value ? '  ◄' : ''}
                  </Text>
                </Box>
              ))}
            </Box>

            <Divider />

            {/* Horns Toggle Selection */}
            <Box flexDirection="column" gap={0}>
              <Text bold color={mascotPane === 'horns' ? 'suggestion' : undefined}>
                {mascotPane === 'horns' ? '▸ ' : '  '}Horns Visibility
              </Text>
              <Box marginLeft={2}>
                <Text bold={mascotPane === 'horns'} color={mascotPane === 'horns' ? 'suggestion' : undefined}>
                  {showHorns ? '[x] Show Horns' : '[ ] Show Horns'}
                </Text>
              </Box>
            </Box>
          </Box>
        </Tab>
      </Tabs>

      {/* Footer */}
      <Box marginTop={1} justifyContent="center">
        <Text dimColor>
          Tab switch tabs ·{' '}
          {selectedTab === 'prompt'
            ? '↑↓ select · Enter confirm'
            : selectedTab === 'spinner'
              ? '↑↓ select · Enter confirm'
              : mascotPane === 'body'
                ? '↑↓ body · Tab eyes'
                : mascotPane === 'eyes'
                  ? '↑↓ eyes · Tab horns'
                  : 'Space/Enter/Arrows toggle horns · Tab body'}
          {' · '}Enter save · Esc close
        </Text>
      </Box>
    </Dialog>
  );
}

// ─── Command Entry Point ─────────────────────────────────────────────────────

export async function call(
  onDone: LocalJSXCommandOnDone,
  context: ToolUseContext & LocalJSXCommandContext,
  args: string,
): Promise<React.ReactNode | null> {
  // Teammates cannot set their own color
  if (isTeammate()) {
    onDone('Cannot set color: This session is a swarm teammate. Teammate colors are assigned by the team leader.', {
      display: 'system',
    });
    return null;
  }

  // If arguments are provided, handle immediately without showing interactive UI
  if (args && args.trim() !== '') {
    const colorArg = args.trim().toLowerCase();

    // Handle reset to default (gray)
    if (RESET_ALIASES.includes(colorArg as (typeof RESET_ALIASES)[number])) {
      const sessionId = getSessionId() as UUID;
      const fullPath = getTranscriptPath();
      await saveAgentColor(sessionId, 'default', fullPath);

      context.setAppState(prev => ({
        ...prev,
        standaloneAgentContext: {
          ...prev.standaloneAgentContext,
          name: prev.standaloneAgentContext?.name ?? '',
          color: undefined,
        },
      }));

      onDone('Session color reset to default', { display: 'system' });
      return null;
    }

    if (!AGENT_COLORS.includes(colorArg as AgentColorName)) {
      const colorList = AGENT_COLORS.join(', ');
      onDone(`Invalid color "${colorArg}". Available colors: ${colorList}, default`, { display: 'system' });
      return null;
    }

    const sessionId = getSessionId() as UUID;
    const fullPath = getTranscriptPath();

    await saveAgentColor(sessionId, colorArg, fullPath);

    context.setAppState(prev => ({
      ...prev,
      standaloneAgentContext: {
        ...prev.standaloneAgentContext,
        name: prev.standaloneAgentContext?.name ?? '',
        color: colorArg as AgentColorName,
      },
    }));

    onDone(`Session color set to: ${colorArg}`, { display: 'system' });
    return null;
  }

  // No arguments provided — open interactive Color panel
  const currentColorSetting = context.getAppState().standaloneAgentContext?.color ?? 'default';
  return <ColorPanel onDone={onDone} initialColorSetting={currentColorSetting} />;
}
