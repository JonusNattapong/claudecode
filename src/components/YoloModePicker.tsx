import * as React from 'react';
import { useState } from 'react';
import { Box, Text } from '../ink.js';
import { useKeybindings } from '../keybindings/useKeybinding.js';
import { type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS, logEvent } from '../services/analytics/index.js';
import { type AppState, useAppState, useSetAppState } from '../state/AppState.js';
import { transitionPermissionMode } from '../utils/permissions/permissionSetup.js';
import { permissionModeSymbol, permissionModeTitle } from '../utils/permissions/PermissionMode.js';
import type { PermissionMode } from '../utils/permissions/PermissionMode.js';
import type { ToolPermissionContext } from '../Tool.js';
import type { LocalJSXCommandOnDone } from '../types/command.js';
import { Dialog } from './design-system/Dialog.js';

type YoloTier = 'yoloLite' | 'yolo' | 'yoloMax';

type YoloTierConfig = {
  mode: YoloTier;
  title: string;
  description: string;
  symbol: string;
  color: 'yoloLite' | 'yolo' | 'yoloMax';
  warning?: string;
};

const YOLO_TIERS: YoloTierConfig[] = [
  {
    mode: 'yoloLite',
    title: 'YOLO Lite',
    description: 'Auto-allow most actions, but still asks for necessary dangerous or sensitive operations',
    symbol: '1',
    color: 'yoloLite',
    warning: 'Guardian stays on for destructive commands and sensitive files',
  },
  {
    mode: 'yolo',
    title: 'YOLO ALLOW',
    description: 'Auto-allow tool use broadly for trusted work sessions',
    symbol: '2',
    color: 'yolo',
    warning: 'Use only in repositories you trust',
  },
  {
    mode: 'yoloMax',
    title: 'YOLO MAX',
    description: 'Full autonomous mode: auto-allow tools, bypass sandbox when available, and find answers instead of asking',
    symbol: '3',
    color: 'yoloMax',
    warning: 'Bypasses sandbox when allowed and pushes the assistant to resolve questions on its own',
  },
];

function isYoloTier(mode: PermissionMode): mode is YoloTier {
  return mode === 'yoloLite' || mode === 'yolo' || mode === 'yoloMax';
}

type Props = {
  onDone: LocalJSXCommandOnDone;
  defaultTier?: YoloTier;
};

export function YoloModePicker({ onDone, defaultTier }: Props) {
  const currentMode = useAppState((s) => s.toolPermissionContext.mode) as PermissionMode;
  const [selectedTier, setSelectedTier] = useState<YoloTier | null>(
    defaultTier ?? (isYoloTier(currentMode) ? currentMode : null),
  );
  const toolPermissionContext = useAppState((s) => s.toolPermissionContext) as ToolPermissionContext;
  const setAppState = useSetAppState();

  const handleConfirm = () => {
    if (!selectedTier) return;

    const newContext = transitionPermissionMode(
      currentMode,
      selectedTier,
      toolPermissionContext,
    );

    setAppState((prev) => ({
      ...prev,
      toolPermissionContext: newContext,
    }));

    if (selectedTier === 'yoloMax') {
      process.env.CLAUDE_CODE_YOLO_AUTONOMY = 'true';
    } else {
      delete process.env.CLAUDE_CODE_YOLO_AUTONOMY;
    }

    const tierConfig = YOLO_TIERS.find((t) => t.mode === selectedTier)!;
    logEvent('tengu_yolo_mode_activated', {
      mode: selectedTier as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    });

    onDone(
      `${tierConfig.symbol} ${tierConfig.title} mode enabled · ${tierConfig.description}`,
    );
  };

  const handleCancel = () => {
    const message = selectedTier
      ? `Kept current mode: ${permissionModeSymbol(currentMode)} ${permissionModeTitle(currentMode)}`
      : 'Kept current mode';
    onDone(message, { display: 'system' });
  };

  const handleToggle = () => {
    if (!selectedTier) {
      setSelectedTier('yoloLite');
      return;
    }
    const currentIndex = YOLO_TIERS.findIndex((t) => t.mode === selectedTier);
    const nextIndex = (currentIndex + 1) % YOLO_TIERS.length;
    setSelectedTier(YOLO_TIERS[nextIndex].mode);
  };

  useKeybindings(
    {
      'confirm:yes': handleConfirm,
      'confirm:nextField': handleToggle,
      'confirm:next': handleToggle,
      'confirm:previous': handleToggle,
      'confirm:cycleMode': handleToggle,
      'confirm:toggle': handleToggle,
    },
    { context: 'Confirmation' },
  );

  const selectedConfig = YOLO_TIERS.find((t) => t.mode === selectedTier);

  return (
    <Dialog
      title="YOLO Mode"
      subtitle={`Current: ${permissionModeSymbol(currentMode)} ${permissionModeTitle(currentMode)}`}
      onCancel={handleCancel}
      color={selectedConfig?.color ?? 'yolo'}
    >
      {YOLO_TIERS.map((tier) => (
        <Box
          key={tier.mode}
          flexDirection="row"
          gap={2}
          marginLeft={2}
        >
          <Text bold={selectedTier === tier.mode} color={selectedTier === tier.mode ? tier.color : undefined}>
            {selectedTier === tier.mode ? '●' : '○'} {tier.symbol} {tier.title}
          </Text>
        </Box>
      ))}
      <Box marginLeft={2} marginTop={1}>
        <Text dimColor={true}>
          {selectedConfig
            ? selectedConfig.description
            : 'Tab to cycle · Enter to confirm · Esc to cancel'}
        </Text>
      </Box>
      {selectedConfig?.warning && (
        <Box marginLeft={2} marginTop={1}>
          <Text color="warning">{selectedConfig.warning}</Text>
        </Box>
      )}
    </Dialog>
  );
}
