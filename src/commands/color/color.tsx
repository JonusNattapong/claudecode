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

// ─── Helpers ───────────────────────────────────────────────────────────────────

function cycleColor(
  colors: ReadonlyArray<{ label: string; value: string }>,
  current: string,
  setter: (v: string) => void,
  dir: number,
) {
  const idx = colors.findIndex(c => c.value === current);
  const next = idx + dir;
  if (next < 0) setter(colors[colors.length - 1]!.value);
  else if (next >= colors.length) setter(colors[0]!.value);
  else setter(colors[next]!.value);
}

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

  const [bodyColor, setBodyColor] = useState<string>((config as any).clawdBodyColor ?? 'clawd_body');
  const [eyeColor, setEyeColor] = useState<string>((config as any).clawdEyeColor ?? 'clawd_eye');
  const [showHorns, setShowHorns] = useState<boolean>((config as any).showClawdHorns ?? true);
  const [spinnerColor, setSpinnerColor] = useState<string>((config as any).spinnerColor ?? 'default');
  const [mascotField, setMascotField] = useState<'body' | 'eye' | 'horns'>('body');

  // Keyboard: cycle body/eye colors with ←→, Tab between fields
  useInput((input, key) => {
    if (selectedTab !== 'mascot') return;

    if (key.tab) {
      setMascotField(f => (f === 'body' ? 'eye' : f === 'eye' ? 'horns' : 'body'));
      return;
    }

    if (mascotField === 'body') {
      if (key.leftArrow) cycleColor(CLAWD_BODY_COLORS, bodyColor, setBodyColor, -1);
      if (key.rightArrow) cycleColor(CLAWD_BODY_COLORS, bodyColor, setBodyColor, 1);
      if (key.return) {
        saveGlobalConfig(prev => ({ ...prev, clawdBodyColor: bodyColor }));
        onDone(`Body color saved: ${bodyColor}`, { display: 'system' });
      }
      return;
    }

    if (mascotField === 'eye') {
      if (key.leftArrow) cycleColor(CLAWD_EYE_COLORS, eyeColor, setEyeColor, -1);
      if (key.rightArrow) cycleColor(CLAWD_EYE_COLORS, eyeColor, setEyeColor, 1);
      if (key.return) {
        saveGlobalConfig(prev => ({ ...prev, clawdEyeColor: eyeColor }));
        onDone(`Eye color saved: ${eyeColor}`, { display: 'system' });
      }
      return;
    }

    if (mascotField === 'horns') {
      if (key.return || key.leftArrow || key.rightArrow || key.upArrow || key.downArrow || input === ' ') {
        setShowHorns(h => {
          const next = !h;
          saveGlobalConfig(prev => ({ ...prev, showClawdHorns: next }));
          return next;
        });
      }
    }
  });

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

  return (
    <Dialog
      title="Color & Customization"
      subtitle="Prompt bar · Spinner · Clawd mascot colors"
      onCancel={handleCancel}
      hideInputGuide
    >
      <Tabs selectedTab={selectedTab} onTabChange={setSelectedTab} defaultTab="prompt" useFullWidth navFromContent disableNavigation={selectedTab === 'mascot'}>
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
              <Text dimColor italic>Live preview</Text>
            </Box>

            {/* Body & Eye Color — inline */}
            <Box flexDirection="row" gap={3}>
              <Text bold color={mascotField === 'body' ? 'suggestion' : undefined}>body</Text>
              <Text
                bold={mascotField === 'body'}
                color={mascotField === 'body' ? 'suggestion' : bodyColor}
              >
                {mascotField === 'body' ? '▸' : ''} {CLAWD_BODY_COLORS.find(c => c.value === bodyColor)?.label ?? bodyColor}
              </Text>
              <Text bold color={mascotField === 'eye' ? 'suggestion' : undefined}>eye</Text>
              <Text
                bold={mascotField === 'eye'}
                color={mascotField === 'eye' ? 'suggestion' : eyeColor}
              >
                {mascotField === 'eye' ? '▸' : ''} {CLAWD_EYE_COLORS.find(c => c.value === eyeColor)?.label ?? eyeColor}
              </Text>
            </Box>

            {/* Horns Toggle */}
            <Box flexDirection="row" gap={2}>
              <Text bold color={mascotField === 'horns' ? 'suggestion' : undefined}>horns</Text>
              <Text
                bold={mascotField === 'horns'}
                color={mascotField === 'horns' ? 'suggestion' : (showHorns ? 'success' : undefined)}
                dimColor={mascotField !== 'horns' && !showHorns}
              >
                {mascotField === 'horns' ? '▸' : ''} {showHorns ? 'Show' : 'Hide'}
              </Text>
            </Box>
          </Box>
        </Tab>
      </Tabs>

      {/* Footer */}
      <Box marginTop={1} justifyContent="center">
        <Text dimColor>
          {selectedTab === 'mascot'
            ? 'Tab switch field · ←→ cycle color · Enter save'
            : 'Tab/←→ switch tabs · ↑↓ select · Enter confirm'}
          {' · '}Esc close
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
  if (isTeammate()) {
    onDone('Cannot set color: This session is a swarm teammate. Teammate colors are assigned by the team leader.', {
      display: 'system',
    });
    return null;
  }

  if (args && args.trim() !== '') {
    const colorArg = args.trim().toLowerCase();

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

  const currentColorSetting = context.getAppState().standaloneAgentContext?.color ?? 'default';
  return <ColorPanel onDone={onDone} initialColorSetting={currentColorSetting} />;
}
