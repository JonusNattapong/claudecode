#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');
const p = spawn('bun', [path.join(__dirname, '..', 'dist', 'main.js'), ...process.argv.slice(2)], {
  stdio: 'inherit',
});
p.on('exit', code => process.exit(code || 0));
