/**
 * Shared utilities for expanding environment variables in MCP server configurations
 */

/**
 * Regex matching a valid POSIX shell variable name at the start of
 * an expansion expression. Variable names are [a-zA-Z_][a-zA-Z0-9_]*.
 * POSIX operators (% # / : = + ?) and their arguments follow the name
 * but are NOT part of it — avoid treating `${var%pattern}` as a lookup
 * of env var "var%pattern".
 */
const VAR_NAME_RE = /^([a-zA-Z_][a-zA-Z0-9_]*)/

/**
 * Expand environment variables in a string value
 * Handles ${VAR} and ${VAR:-default} syntax
 * @returns Object with expanded string and list of missing variables
 */
export function expandEnvVarsInString(value: string): {
  expanded: string
  missingVars: string[]
} {
  const missingVars: string[] = []

  const expanded = value.replace(/\$\{([^}]+)\}/g, (match, varContent) => {
    // Split on :- to support default values (limit to 2 parts to preserve :- in defaults)
    const [varName, defaultValue] = varContent.split(':-', 2)

    // Extract the actual variable name before any POSIX operator
    // (% # / : = + ?) — these are expansion operators, not part of the name.
    // e.g. ${var%pattern} has name "var", not "var%pattern".
    const varNameMatch = varName.match(VAR_NAME_RE)
    const cleanVarName = varNameMatch ? varNameMatch[1] : varName
    const envValue = process.env[cleanVarName]

    if (envValue !== undefined) {
      // If the expression has POSIX operators (e.g. ${var%pattern}), don't
      // expand — preserve the original so downstream or the user sees the
      // intended expression. Only plain ${VAR} and ${VAR:-default} are expanded.
      if (cleanVarName.length === varName.length) {
        return envValue
      }
      // Expression has operators we don't support for expansion — keep as-is
      return match
    }
    if (defaultValue !== undefined) {
      return defaultValue
    }

    // Track missing variable for error reporting (report the clean name)
    missingVars.push(cleanVarName)
    // Return original if not found (allows debugging but will be reported as error)
    return match
  })

  return {
    expanded,
    missingVars,
  }
}
