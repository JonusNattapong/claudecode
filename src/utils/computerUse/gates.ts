/**
 * Gates and configuration for Computer Use.
 * Replaces @ant/computer-use-mcp/types with our own types.
 *
 * Env var overrides:
 * - ENABLE_COMPUTER_USE=1 or COMPUTER_USE_ENABLED=1: Force-enable Computer Use
 *   (bypasses both the compile-time feature('CHICAGO_MCP') gate and this gate).
 * - ENABLE_COMPUTER_USE=0 or COMPUTER_USE_ENABLED=0: Force-disable Computer Use.
 *
 * The compile-time `feature('CHICAGO_MCP')` gate in main.tsx, query.ts, etc.
 * also checks `process.env.ENABLE_COMPUTER_USE === '1'` as a runtime fallback,
 * so setting this env var unlocks Computer Use end-to-end.
 */

import type { CoordinateMode, CuSubGates } from './hostAdapter.js';

type CuConfig = CuSubGates & {
  enabled: boolean;
  coordinateMode: CoordinateMode;
};

const DEFAULTS: CuConfig = {
  enabled: false,
  pixelValidation: false,
  clipboardPasteMultiline: true,
  mouseAnimation: true,
  hideBeforeAction: false,
  autoTargetDisplay: true,
  clipboardGuard: true,
  coordinateMode: 'pixels',
};

export function getChicagoEnabled(): boolean {
  // Allow env override: COMPUTER_USE_ENABLED=1 or ENABLE_COMPUTER_USE=1 forces on
  if (process.env.COMPUTER_USE_ENABLED === '1' || process.env.ENABLE_COMPUTER_USE === '1') return true;
  if (process.env.COMPUTER_USE_ENABLED === '0' || process.env.ENABLE_COMPUTER_USE === '0') return false;
  return DEFAULTS.enabled;
}

export function getChicagoSubGates(): CuSubGates {
  const { enabled: _e, coordinateMode: _c, ...subGates } = readConfig();
  return subGates;
}

let frozenCoordinateMode: CoordinateMode | undefined;
export function getChicagoCoordinateMode(): CoordinateMode {
  frozenCoordinateMode ??= readConfig().coordinateMode;
  return frozenCoordinateMode;
}

function readConfig(): CuConfig {
  return { ...DEFAULTS };
}
