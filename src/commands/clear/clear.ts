import type { LocalCommandCall } from '../../types/command.js'
import { clearConversation } from './conversation.js'
import { getSessionId } from '../../bootstrap/state.js'
import { saveCustomTitle } from '../../utils/sessionStorage.js'

export const call: LocalCommandCall = async (args, context) => {
  // If a name was provided (e.g. /clear my-label), save it as a custom title
  // before clearing so the session shows up with that name in /resume
  const name = args?.trim()
  if (name) {
    await saveCustomTitle(getSessionId(), name.replace(/\s+/g, ' ').trim())
  }
  await clearConversation(context)
  return { type: 'text', value: '' }
}
