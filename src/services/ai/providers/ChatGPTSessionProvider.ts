import type { ProviderClient, ProviderInitOptions, ProviderInterface } from './ProviderInterface.js'
import axios from 'axios'

export class ChatGPTSessionProvider implements ProviderInterface {
  readonly providerId = 'openai_browser' as const
  readonly label = 'ChatGPT Plus (Web)'

  getProviderId() {
    return this.providerId
  }

  getProviderLabel() {
    return this.label
  }

  getProviderApiKeyEnvVar() {
    return 'CHATGPT_SESSION_TOKEN'
  }

  async createClient(options: ProviderInitOptions): Promise<ProviderClient> {
    const sessionToken = options.apiKey ?? process.env.CHATGPT_SESSION_TOKEN

    // This is a simplified client that proxies requests to chatgpt.com
    return {
      createMessage: async (params: any) => {
        const response = await axios.post('https://chatgpt.com/backend-api/conversation', params, {
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        })
        return response.data
      }
    } as any
  }
}
