// Global type declarations
declare module 'bun:bundle' {
  export function feature(name: string): boolean
}

declare global {
  var MACRO: {
    VERSION: string
    FEEDBACK_CHANNEL: string
    ISSUES_EXPLAINER: string
  }
}

export {}
