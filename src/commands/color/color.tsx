import type { UUID } from 'crypto';
import type * as React from 'react';
import { useState } from 'react';
import { getSessionId } from '../../bootstrap/state.js';
import { Select } from '../../components/CustomSelect/index.js';
import { Dialog } from '../../components/design-system/Dialog.js';
import { Divider } from '../../components/design-system/Divider.js';
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
  { label: 'Purple', value: 'clawd_body' as const, dotColor: 'magentaBright' as const },
  { label: 'Magenta', value: 'ansi:magenta' as const, dotColor: 'magentaBright' as const },
  { label: 'Cyan', value: 'ansi:cyan' as const, dotColor: 'cyan' as const },
  { label: 'Gold', value: 'ansi:yellow' as const, dotColor: 'yellow' as const },
  { label: 'Red', value: 'ansi:red' as const, dotColor: 'red' as const },
  { label: 'Green', value: 'ansi:green' as const, dotColor: 'green' as const },
  { label: 'Blue', value: 'ansi:blue' as const, dotColor: 'blue' as const },
  { label: 'Orange', value: 'ansi:yellowBright' as const, dotColor: 'yellowBright' as const },
  { label: 'Pink', value: 'ansi:magentaBright' as const, dotColor: 'magentaBright' as const },
  { label: 'White', value: 'ansi:white' as const, dotColor: 'white' as const },
  { label: 'Gray', value: 'ansi:blackBright' as const, dotColor: 'blackBright' as const },
] as const;

const CLAWD_EYE_COLORS = [
  { label: 'Red', value: 'clawd_eye' as const, dotColor: 'red' as const },
  { label: 'Yellow', value: 'ansi:yellow' as const, dotColor: 'yellow' as const },
  { label: 'Green', value: 'ansi:green' as const, dotColor: 'green' as const },
  { label: 'Blue', value: 'ansi:blue' as const, dotColor: 'blue' as const },
  { label: 'Cyan', value: 'ansi:cyan' as const, dotColor: 'cyan' as const },
  { label: 'White', value: 'ansi:white' as const, dotColor: 'white' as const },
  { label: 'Orange', value: 'ansi:yellowBright' as const, dotColor: 'yellowBright' as const },
  { label: 'Pink', value: 'ansi:magentaBright' as const, dotColor: 'magentaBright' as const },
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

const TABS = ['Prompt Bar', 'Spinner', 'Mascot'] as const;
type TabId = (typeof TABS)[number];

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
  const [selectedTab, setSelectedTab] = useState<TabId>('Prompt Bar');
  const isMascotTab = selectedTab === 'Mascot';

  // Spinner color
  const [spinnerColor, setSpinnerColor] = useState<string>((config as any).spinnerColor ?? 'default');

  // Clawd colors
  const [bodyColor, setBodyColor] = useState<string>((config as any).clawdBodyColor ?? 'clawd_body');
  const [eyeColor, setEyeColor] = useState<string>((config as any).clawdEyeColor ?? 'clawd_eye');
  const [showHorns, setShowHorns] = useState<boolean>((config as any).showClawdHorns ?? true);
  const [focusedSection, setFocusedSection] = useState<'body' | 'eyes' | 'horns'>('body');
  const [focusedBodyIdx, setFocusedBodyIdx] = useState(
    CLAWD_BODY_COLORS.findIndex(c => c.value === ((config as any).clawdBodyColor ?? 'clawd_body')),
  );
  const [focusedEyeIdx, setFocusedEyeIdx] = useState(
    CLAWD_EYE_COLORS.findIndex(c => c.value === ((config as any).clawdEyeColor ?? 'clawd_eye')),
  );

  const bodyActive = isMascotTab && focusedSection === 'body';
  const eyesActive = isMascotTab && focusedSection === 'eyes';
  const hornsActive = isMascotTab && focusedSection === 'horns';
  const bodyCur = CLAWD_BODY_COLORS[focusedBodyIdx]!;
  const eyeCur = CLAWD_EYE_COLORS[focusedEyeIdx]!;

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

  // ── Single global key handler (no nested keybinding conflicts) ──────────
  useInput(
    (input, key) => {
      // Tab switches tabs
      if (key.tab) {
        setSelectedTab(t => {
          const idx = TABS.indexOf(t);
          return TABS[(idx + 1) % TABS.length]!;
        });
        return;
      }

      if (key.shift && key.tab) {
        setSelectedTab(t => {
          const idx = TABS.indexOf(t);
          return TABS[(idx - 1 + TABS.length) % TABS.length]!;
        });
        return;
      }

      // ── Mascot tab keybindings ──
      if (selectedTab !== 'Mascot') return;

      // ↑↓ switch sections
      if (key.upArrow) {
        setFocusedSection(s => {
          if (s === 'body') return 'horns';
          if (s === 'eyes') return 'body';
          return 'eyes';
        });
        return;
      }
      if (key.downArrow) {
        setFocusedSection(s => {
          if (s === 'body') return 'eyes';
          if (s === 'eyes') return 'horns';
          return 'body';
        });
        return;
      }

      // ←→ cycle colors in active section
      if (key.leftArrow) {
        if (focusedSection === 'body') {
          setFocusedBodyIdx(i => {
            const next = i <= 0 ? CLAWD_BODY_COLORS.length - 1 : i - 1;
            setBodyColor(CLAWD_BODY_COLORS[next]!.value);
            return next;
          });
        } else if (focusedSection === 'eyes') {
          setFocusedEyeIdx(i => {
            const next = i <= 0 ? CLAWD_EYE_COLORS.length - 1 : i - 1;
            setEyeColor(CLAWD_EYE_COLORS[next]!.value);
            return next;
          });
        } else {
          setShowHorns(h => !h);
        }
        return;
      }
      if (key.rightArrow) {
        if (focusedSection === 'body') {
          setFocusedBodyIdx(i => {
            const next = i >= CLAWD_BODY_COLORS.length - 1 ? 0 : i + 1;
            setBodyColor(CLAWD_BODY_COLORS[next]!.value);
            return next;
          });
        } else if (focusedSection === 'eyes') {
          setFocusedEyeIdx(i => {
            const next = i >= CLAWD_EYE_COLORS.length - 1 ? 0 : i + 1;
            setEyeColor(CLAWD_EYE_COLORS[next]!.value);
            return next;
          });
        } else {
          setShowHorns(h => !h);
        }
        return;
      }

      // Enter saves the currently active value
      if (key.return) {
        if (focusedSection === 'body') {
          saveGlobalConfig(prev => ({ ...prev, clawdBodyColor: bodyColor }));
        } else if (focusedSection === 'eyes') {
          saveGlobalConfig(prev => ({ ...prev, clawdEyeColor: eyeColor }));
        } else {
          saveGlobalConfig(prev => ({ ...prev, showClawdHorns: showHorns }));
        }
        return;
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
      {/* Custom tab bar — no keybinding conflicts */}
      <Box flexDirection="row" gap={1} marginTop={1}>
        {TABS.map(tab => {
          const isCurrent = selectedTab === tab;
          return (
            <Text
              key={tab}
              inverse={isCurrent}
              bold={isCurrent}
              color={isCurrent ? 'suggestion' : undefined}
            >
              {' '}
              {tab}{' '}
            </Text>
          );
        })}
      </Box>

      {/* ── Prompt Bar Tab ── */}
      {selectedTab === 'Prompt Bar' && (
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
      )}

      {/* ── Spinner Tab ── */}
      {selectedTab === 'Spinner' && (
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
      )}

      {/* ── Mascot Tab ── */}
      {selectedTab === 'Mascot' && (
        <Box flexDirection="column" gap={0} marginTop={1}>
          {/* Clawd Preview */}
          <Box flexDirection="column" alignItems="center" marginBottom={1}>
            <Clawd pose="default" showHorns={showHorns} bodyColor={bodyColor} eyeColor={eyeColor} />
            <Text dimColor italic>
              Live preview
            </Text>
          </Box>


          {/* Mascot sections — clean one-liner per section */}
          <Box flexDirection="column" gap={0}>
            {/* Body */}
            <Box flexDirection="row" alignItems="center" gap={1}>
              <Text bold color={bodyActive ? 'suggestion' : undefined}>
                {bodyActive ? '▸ ' : '  '}Body
              </Text>
              <Text color={bodyCur.dotColor as string}>●</Text>
              <Text bold={bodyActive} color={bodyActive ? 'suggestion' : undefined}>
                {bodyCur.label}
              </Text>
              {bodyActive && (
                <Text dimColor>
                  {'  '}◄ ►
                </Text>
              )}
            </Box>

            {/* Eyes */}
            <Box flexDirection="row" alignItems="center" gap={1}>
              <Text bold color={eyesActive ? 'suggestion' : undefined}>
                {eyesActive ? '▸ ' : '  '}Eyes
              </Text>
              <Text color={eyeCur.dotColor as string}>●</Text>
              <Text bold={eyesActive} color={eyesActive ? 'suggestion' : undefined}>
                {eyeCur.label}
              </Text>
              {eyesActive && (
                <Text dimColor>
                  {'  '}◄ ►
                </Text>
              )}
            </Box>

            {/* Horns */}
            <Box flexDirection="row" alignItems="center" gap={1}>
              <Text bold color={hornsActive ? 'suggestion' : undefined}>
                {hornsActive ? '▸ ' : '  '}Horns
              </Text>
              <Text bold color={hornsActive ? 'suggestion' : undefined}>
                {showHorns ? '[x] Show Horns' : '[ ] Show Horns'}
              </Text>
              {hornsActive && (
                <Text dimColor>
                  {'  '}◄ ►
                </Text>
              )}
            </Box>
          </Box>
        </Box>
      )}

      {/* Footer */}
      <Box marginTop={1} justifyContent="center">
        <Text dimColor>
          Tab switch tabs ·{' '}
          {isMascotTab
            ? '↑↓ sections · ←→ colors · Enter save'
            : '↑↓ select · Enter confirm'}
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
