const SECRET_PATTERNS = [
  // Anthropic API Key
  /(sk-ant-[a-zA-Z0-9_-]{32,})/gi,
  // OpenAI API Key
  /(sk-[a-zA-Z0-9_-]{32,})/gi,
  // GitHub PAT
  /(gh[opsu]_[a-zA-Z0-9_-]{36})/gi,
  /(github_pat_[a-zA-Z0-9_-]{82})/gi,
  // Common key-value configs
  /((?:OPENAI_API_KEY|ANTHROPIC_API_KEY|GITHUB_TOKEN|AWS_SECRET_ACCESS_KEY|SECRET|PASSWORD|PASSWORD_HASH|PRIVATE_KEY|API_KEY|JWT_SECRET|DB_PASSWORD)\s*=\s*)(['"]?)([^'"\r\n\s]{8,})(\2)/gi,
  // PostgreSQL/Database URL
  /(mongodb(?:\+srv)?|postgres(?:ql)?|mysql|sqlite):\/\/([^:]+):([^@]+)@([^/]+)\/([^?\r\n\s]+)/gi,
];

export function redactSecrets(text: string): string {
  let redacted = text;

  for (const pattern of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, (match, ...args) => {
      // If it's the key-value config match, keep the variable name but redact the value
      if (typeof args[0] === 'string' && args[0].includes('=')) {
        const prefix = args[0]; // e.g. "OPENAI_API_KEY = "
        const quoteStart = args[1] || '';
        const quoteEnd = args[3] || '';
        return `${prefix}${quoteStart}...redacted...${quoteEnd}`;
      }

      // If it's a database connection string match
      if (match.includes('://')) {
        const protocol = args[0];
        const user = args[1];
        const host = args[3];
        const dbName = args[4];
        return `${protocol}://${user}:...redacted...@${host}/${dbName}`;
      }

      // Default fallback: replace the entire matching token
      return '...redacted...';
    });
  }

  return redacted;
}
