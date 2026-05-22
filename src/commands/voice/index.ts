import type { Command } from '../../commands.js';
import { isVoiceGrowthBookEnabled } from '../../voice/voiceModeEnabled.js';

const voice = {
  type: 'local',
  name: 'voice',
  description: 'Toggle voice mode',
  isEnabled: () => isVoiceGrowthBookEnabled(),
  get isHidden() {
    return !isVoiceGrowthBookEnabled();
  },
  supportsNonInteractive: false,
  load: () => import('./voice.js'),
} satisfies Command;

export default voice;
