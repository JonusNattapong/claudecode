#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');

function hasBun() {
  const whichCommand = process.platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(whichCommand, ['bun'], { stdio: 'ignore', shell: false });
  return result.status === 0;
}

function printBunInstallHelp() {
  const installCommand =
    process.platform === 'win32'
      ? 'powershell -c "irm bun.sh/install.ps1 | iex"'
      : 'curl -fsSL https://bun.sh/install | bash';

  console.error('Claudevil requires Bun at runtime.');
  console.error('This npm package installs the launcher, but the CLI itself runs with Bun.');
  console.error('');
  console.error('Install Bun, then run `claudevil` again:');
  console.error(`  ${installCommand}`);
}

const mainJs = path.join(__dirname, '..', 'dist', 'main.js');
const bunCommand = process.platform === 'win32' ? 'bun.cmd' : 'bun';

if (!hasBun()) {
  printBunInstallHelp();
  process.exit(1);
}

try {
  const result = spawnSync(bunCommand, [mainJs, ...process.argv.slice(2)], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.error) {
    throw result.error;
  }

  process.exit(result.status ?? 0);
} catch (e) {
  console.error('Error executing Bun:', e.message || e);
  process.exit(e.status ?? 1);
}
