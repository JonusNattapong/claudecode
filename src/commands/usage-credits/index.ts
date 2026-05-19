import { getIsNonInteractiveSession } from '../../bootstrap/state.js';
import type { Command } from '../../commands.js';
import { isOverageProvisioningAllowed } from '../../utils/auth.js';
import { isEnvTruthy } from '../../utils/envUtils.js';

function isUsageCreditsAllowed(): boolean {
  if (isEnvTruthy(process.env.DISABLE_EXTRA_USAGE_COMMAND)) {
    return false;
  }
  return isOverageProvisioningAllowed();
}

export const usageCredits = {
  type: 'local-jsx',
  name: 'usage-credits',
  aliases: ['extra-usage'],
  description: 'Configure usage credits to keep working when limits are hit',
  isEnabled: () => isUsageCreditsAllowed() && !getIsNonInteractiveSession(),
  load: () => import('./usage-credits.js'),
} satisfies Command;

export const usageCreditsNonInteractive = {
  type: 'local',
  name: 'usage-credits',
  aliases: ['extra-usage'],
  supportsNonInteractive: true,
  description: 'Configure usage credits to keep working when limits are hit',
  isEnabled: () => isUsageCreditsAllowed() && getIsNonInteractiveSession(),
  get isHidden() {
    return !getIsNonInteractiveSession();
  },
  load: () => import('./usage-credits-noninteractive.js'),
} satisfies Command;
