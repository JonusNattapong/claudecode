import type React from 'react';
import type { LocalJSXCommandContext } from '../../commands.js';
import type { LocalJSXCommandOnDone } from '../../types/command.js';
import { Login } from '../login/login.js';
import { runUsageCredits } from './usage-credits-core.js';
export async function call(
  onDone: LocalJSXCommandOnDone,
  context: LocalJSXCommandContext,
): Promise<React.ReactNode | null> {
  const result = await runUsageCredits();
  if (result.type === 'message') {
    onDone(result.value);
    return null;
  }
  return (
    <Login
      startingMessage={'Starting new login following /usage-credits. Exit with Ctrl-C to use existing account.'}
      onDone={success => {
        context.onChangeAPIKey();
        onDone(success ? 'Login successful' : 'Login interrupted');
      }}
    />
  );
}
