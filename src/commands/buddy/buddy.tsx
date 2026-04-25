import * as React from 'react'
import type { LocalJSXCommandCall } from '../../types/command.js'
import { Box, Text } from '../../ink.js'

interface BuddySetupProps {
  onDone: (result?: string, options?: { display?: 'system' | 'user' | 'skip' }) => void
}

function BuddySetup({ onDone }: BuddySetupProps): React.ReactNode {
  const [species, setSpecies] = React.useState('duck')
  const [visible, setVisible] = React.useState(true)
  const [animation, setAnimation] = React.useState('idle')

  function handleSave() {
    onDone(`Buddy saved: ${species} (visible: ${visible}, animation: ${animation})`)
  }

  React.useEffect(() => {
    handleSave()
  }, [species, visible, animation])

  return React.createElement(
    Box,
    { flexDirection: 'column', padding: 1 },
    React.createElement(Text, { bold: true }, 'Buddy Settings'),
    React.createElement(Text, null, `Species: ${species}`),
    React.createElement(Text, null, `Visible: ${visible ? 'Yes' : 'No'}`),
    React.createElement(Text, { dimColor: true }, 'Use /buddy setup in session to configure'),
  )
}

export const call: LocalJSXCommandCall = async (onDone, _context, args) => {
  const parts = args.toLowerCase().split(' ')
  const command = parts[0]

  if (command === 'show') {
    onDone('Buddy is now visible!')
    return null
  }

  if (command === 'hide') {
    onDone('Buddy is now hidden!')
    return null
  }

  if (command === 'setup' || !command) {
    return React.createElement(BuddySetup, { onDone })
  }

  onDone(`Buddy commands: /buddy show, /buddy hide, /buddy setup`)
  return null
}