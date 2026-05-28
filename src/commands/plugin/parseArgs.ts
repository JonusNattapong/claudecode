// Parse plugin subcommand arguments into structured commands
export type ParsedCommand =
  | { type: 'menu' }
  | { type: 'help' }
  | { type: 'install'; marketplace?: string; plugin?: string }
  | { type: 'manage' }
  | { type: 'uninstall'; plugin?: string }
  | { type: 'enable'; plugin?: string }
  | { type: 'disable'; plugin?: string }
  | { type: 'validate'; path?: string }
  | {
      type: 'marketplace';
      action?: 'add' | 'remove' | 'update' | 'list';
      target?: string;
      scope?: 'user' | 'project' | 'local';
    };

export function parsePluginArgs(args?: string): ParsedCommand {
  if (!args) {
    return { type: 'menu' };
  }

  const parts = args.trim().split(/\s+/);
  const command = parts[0]?.toLowerCase();

  switch (command) {
    case 'help':
    case '--help':
    case '-h':
      return { type: 'help' };

    case 'install':
    case 'i': {
      const target = parts[1];
      if (!target) {
        return { type: 'install' };
      }

      // Check if it's in format plugin@marketplace
      if (target.includes('@')) {
        const [plugin, marketplace] = target.split('@');
        return { type: 'install', plugin, marketplace };
      }

      // Check if the target looks like a marketplace (URL or path)
      const isMarketplace =
        target.startsWith('http://') ||
        target.startsWith('https://') ||
        target.startsWith('file://') ||
        target.includes('/') ||
        target.includes('\\');

      if (isMarketplace) {
        // This is a marketplace URL/path, no plugin specified
        return { type: 'install', marketplace: target };
      }

      // Otherwise treat it as a plugin name
      return { type: 'install', plugin: target };
    }

    case 'manage':
      return { type: 'manage' };

    case 'uninstall':
      return { type: 'uninstall', plugin: parts[1] };

    case 'enable':
      return { type: 'enable', plugin: parts[1] };

    case 'disable':
      return { type: 'disable', plugin: parts[1] };

    case 'validate': {
      const target = parts.slice(1).join(' ').trim();
      return { type: 'validate', path: target || undefined };
    }

    case 'marketplace':
    case 'market': {
      const action = parts[1]?.toLowerCase();
      const targetParts: string[] = [];
      let scope: 'user' | 'project' | 'local' | undefined;

      for (let i = 2; i < parts.length; i++) {
        const part = parts[i]!;
        if (part === '--scope' && parts[i + 1]) {
          const scopeVal = parts[i + 1]!.toLowerCase();
          if (scopeVal === 'user' || scopeVal === 'project' || scopeVal === 'local') {
            scope = scopeVal;
          }
          i++;
        } else {
          targetParts.push(part);
        }
      }
      const target = targetParts.join(' ');

      switch (action) {
        case 'add':
          return { type: 'marketplace', action: 'add', target, scope };
        case 'remove':
        case 'rm':
          return { type: 'marketplace', action: 'remove', target, scope };
        case 'update':
          return { type: 'marketplace', action: 'update', target };
        case 'list':
          return { type: 'marketplace', action: 'list' };
        default:
          // No action specified, show marketplace menu
          return { type: 'marketplace' };
      }
    }

    default:
      // Unknown command, show menu
      return { type: 'menu' };
  }
}
