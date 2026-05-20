/**
 * CohereProvider — native Cohere /v2/chat API
 *
 *   POST https://api.cohere.com/v2/chat
 *
 * Not OpenAI-compatible — uses a proprietary endpoint path.
 * Overrides chatPath to /chat instead of /chat/completions.
 */

import { OpenAICompatibleProvider } from './OpenAICompatibleProvider.js';
import type { ProviderId } from './ProviderInterface.js';

export class CohereProvider extends OpenAICompatibleProvider {
  protected chatPath = '/chat';

  constructor() {
    super(
      'cohere' as ProviderId,
      'Cohere',
      'COHERE_API_KEY',
      'https://api.cohere.com/v2',
      true,
    );
  }
}
