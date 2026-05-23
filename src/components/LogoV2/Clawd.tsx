import type * as React from 'react';
import { Box, Text } from '../../ink.js';
import { env } from '../../utils/env.js';

export type ClawdPose =
  | 'default'
  | 'arms-up' // both arms raised (used during jump)
  | 'look-left' // both pupils shifted left
  | 'look-right'; // both pupils shifted right

type Props = {
  pose?: ClawdPose;
  /** Override body color (theme key or raw color string) */
  bodyColor?: string;
  /** Override eye color (theme key or raw color string) */
  eyeColor?: string;
};

// Standard-terminal pose fragments. Each row is split into segments so we can
// vary only the parts that change (eyes, arms) while keeping the body/bg spans
// stable. All poses end up 9 cols wide.
type Segments = {
  /** row 1 left (no bg): optional raised arm + side */
  r1L: string;
  /** row 1 eyes (with bg): left-eye, forehead, right-eye */
  r1E: string;
  /** row 1 right (no bg): side + optional raised arm */
  r1R: string;
  /** row 2 left (no bg): arm + body curve */
  r2L: string;
  /** row 2 right (no bg): body curve + arm */
  r2R: string;
};

const POSES: Record<ClawdPose, Segments> = {
  default: {
    r1L: ' ▐',
    r1E: '▛███▜',
    r1R: '▌',
    r2L: '▝▜',
    r2R: '▛▘',
  },
  'look-left': {
    r1L: ' ▐',
    r1E: '▟███▟',
    r1R: '▌',
    r2L: '▝▜',
    r2R: '▛▘',
  },
  'look-right': {
    r1L: ' ▐',
    r1E: '▙███▙',
    r1R: '▌',
    r2L: '▝▜',
    r2R: '▛▘',
  },
  'arms-up': {
    r1L: '▗▟',
    r1E: '▛███▜',
    r1R: '▙▖',
    r2L: ' ▜',
    r2R: '▛ ',
  },
};

// Apple Terminal uses a bg-fill trick (see below), so only eye poses make
// sense. Arm poses fall back to default.
const APPLE_EYES: Record<ClawdPose, string> = {
  default: ' ▗   ▖ ',
  'look-left': ' ▘   ▘ ',
  'look-right': ' ▝   ▝ ',
  'arms-up': ' ▗   ▖ ',
};

export function Clawd({ pose = 'default', bodyColor, eyeColor }: Props = {}): React.ReactNode {
  if (env.terminal === 'Apple_Terminal') {
    return <AppleTerminalClawd pose={pose} bodyColor={bodyColor} eyeColor={eyeColor} />;
  }

  const p = POSES[pose];
  const bc = bodyColor ?? 'clawd_body';
  const ec = eyeColor ?? 'clawd_eye';
  const bgc = bodyColor ?? 'clawd_body';
  const tHorn = <Text color={bc}>{'  ▗   ▖  '}</Text>;
  const t6 = (
    <Text>
      <Text color={bc}>{p.r1L}</Text>
      <Text color={bc} backgroundColor={ec}>
        {p.r1E}
      </Text>
      <Text color={bc}>{p.r1R}</Text>
    </Text>
  );
  const t10 = (
    <Text>
      <Text color={bc}>{p.r2L}</Text>
      <Text color={bc} backgroundColor={bodyColor ?? 'clawd_background'}>
        █████
      </Text>
      <Text color={bc}>{p.r2R}</Text>
    </Text>
  );
  const t11 = (
    <Text color={bc}>
      {'  '}▘▘ ▝▝{'  '}
    </Text>
  );

  return (
    <Box flexDirection="column">
      {tHorn}
      {t6}
      {t10}
      {t11}
    </Box>
  );
}

function AppleTerminalClawd({ pose, bodyColor, eyeColor }: Props): React.ReactNode {
  const bc = bodyColor ?? 'clawd_body';
  const ec = eyeColor ?? 'clawd_eye';
  const tHorn = <Text color={bc}>{'  ▗   ▖  '}</Text>;
  const t2 = APPLE_EYES[pose];
  const t3 = (
    <Text color={ec} backgroundColor={bc}>
      {t2}
    </Text>
  );
  const t5 = (
    <Text>
      <Text color={bc}>▗</Text>
      {t3}
      <Text color={bc}>▖</Text>
    </Text>
  );
  const t6 = <Text backgroundColor={bc}>{' '.repeat(7)}</Text>;
  const t7 = <Text color={bc}>▘▘ ▝▝</Text>;

  return (
    <Box flexDirection="column" alignItems="center">
      {tHorn}
      {t5}
      {t6}
      {t7}
    </Box>
  );
}
