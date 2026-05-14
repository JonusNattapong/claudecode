import React, { useCallback, useState } from 'react'
import { Box, Text, Link } from '../ink.js'
import { useKeybinding } from '../keybindings/useKeybinding.js'
import { Spinner } from './Spinner.js'
import { KeyboardShortcutHint } from './design-system/KeyboardShortcutHint.js'
import { getGitHubOAuthService, type GitHubOAuthTokens } from '../services/oauth/githubOAuth.js'
import { saveGlobalConfig } from '../utils/config.js'
import { logEvent } from '../services/analytics/index.js'
import { sendNotification } from '../services/notifier.js'

type Props = {
  onDone(tokens: GitHubOAuthTokens | null): void
  onCancel?(): void
}

type LoginStatus =
  | { state: 'select_method' }
  | { state: 'waiting_for_code'; verificationUri: string; userCode: string }
  | { state: 'exchanging_token' }
  | { state: 'success'; tokens: GitHubOAuthTokens }
  | { state: 'error'; message: string }

function SelectMethod({ onSelect, onCancel }: { onSelect: () => void; onCancel?: () => void }) {
  return (
    <Box flexDirection="column">
      <Text marginBottom={1}>GitHub Copilot Login:</Text>
      <Text dimColor marginBottom={2}>
        Use device flow to authenticate with your GitHub account.
      </Text>
      <Box>
        <Text>Press </Text>
        <KeyboardShortcutHint shortcut="Enter" />
        <Text> to start login</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Press </Text>
        <KeyboardShortcutHint shortcut="Esc" />
        <Text dimColor> to cancel</Text>
      </Box>
    </Box>
  )
}

function WaitingForCode({ verificationUri, userCode }: { verificationUri: string; userCode: string }) {
  return (
    <Box flexDirection="column">
      <Text color="yellow" marginBottom={1}>GitHub Device Flow Login</Text>
      <Box marginBottom={1}>
        <Text>1. Open this URL in your browser:</Text>
      </Box>
      <Box marginBottom={1}>
        <Link url={verificationUri}>{verificationUri}</Link>
      </Box>
      <Box marginBottom={1}>
        <Text>2. Enter this code:</Text>
      </Box>
      <Box marginBottom={2}>
        <Text bold color="cyan" style={{ border: '1px solid gray', padding: '0 10px' }}>
          {userCode}
        </Text>
      </Box>
      <Text dimColor marginBottom={1}>Waiting for authorization...</Text>
      <Spinner label="Checking for authorization" />
    </Box>
  )
}

function ExchangingToken() {
  return (
    <Box>
      <Spinner label="Exchanging token..." />
    </Box>
  )
}

function SuccessState() {
  return (
    <Box flexDirection="column">
      <Text color="green">✓ Successfully authenticated with GitHub</Text>
      <Box marginTop={1}>
        <Text dimColor>Press </Text>
        <KeyboardShortcutHint shortcut="Enter" />
        <Text dimColor> to continue</Text>
      </Box>
    </Box>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <Box flexDirection="column">
      <Text color="red">✗ {message}</Text>
      <Box marginTop={1}>
        <Text dimColor>Press </Text>
        <KeyboardShortcutHint shortcut="Enter" />
        <Text dimColor> to retry or </Text>
        <KeyboardShortcutHint shortcut="Esc" />
        <Text dimColor> to cancel</Text>
      </Box>
    </Box>
  )
}

export function GitHubCopilotAuthFlow({ onDone, onCancel }: Props): React.ReactNode {
  const [loginStatus, setLoginStatus] = useState<LoginStatus>({ state: 'select_method' })
  const [oauthService] = useState(() => getGitHubOAuthService())

  const handleSuccess = useCallback(
    (tokens: GitHubOAuthTokens) => {
      saveGlobalConfig((current) => ({
        ...current,
        copilotOAuthTokens: tokens,
      }))

      if (tokens.accessToken) {
        process.env.COPILOT_GITHUB_TOKEN = tokens.accessToken
      }

      logEvent('github_copilot_oauth_success', {})
      sendNotification('GitHub Login Successful', 'Copilot authentication completed')
      onDone(tokens)
    },
    [onDone],
  )

  const startLogin = useCallback(async () => {
    setLoginStatus({ state: 'waiting_for_code', verificationUri: 'https://github.com/login/device', userCode: 'Loading...' })

    try {
      const tokens = await oauthService.startDeviceFlow(
        (verificationUri, userCode) => {
          setLoginStatus({ state: 'waiting_for_code', verificationUri, userCode })
        },
      )
      setLoginStatus({ state: 'exchanging_token' })
      handleSuccess(tokens)
    } catch (error) {
      setLoginStatus({
        state: 'error',
        message: `Login failed: ${(error as Error).message}`,
      })
    }
  }, [oauthService, handleSuccess])

  useKeybinding(
    'confirm:yes',
    () => {
      if (loginStatus.state === 'select_method') {
        startLogin()
      } else if (loginStatus.state === 'error') {
        setLoginStatus({ state: 'select_method' })
      }
    },
    { context: 'Confirmation', isActive: true },
  )

  useKeybinding(
    'confirm:no',
    () => {
      onCancel?.()
    },
    {
      context: 'Confirmation',
      isActive: loginStatus.state !== 'exchanging_token' && loginStatus.state !== 'waiting_for_code',
    },
  )

  if (loginStatus.state === 'select_method') {
    return <SelectMethod onSelect={startLogin} onCancel={onCancel} />
  }

  if (loginStatus.state === 'waiting_for_code') {
    return <WaitingForCode verificationUri={loginStatus.verificationUri} userCode={loginStatus.userCode} />
  }

  if (loginStatus.state === 'exchanging_token') {
    return <ExchangingToken />
  }

  if (loginStatus.state === 'success') {
    return <SuccessState />
  }

  if (loginStatus.state === 'error') {
    return <ErrorState message={loginStatus.message} />
  }

  return null
}