import { describe, expect, test, afterEach } from 'bun:test';
import { checkComputerUseDependencies } from './diagnostics.js';

describe('computerUse diagnostics', () => {
  const originalEnabled = process.env.COMPUTER_USE_ENABLED;
  const originalEnable = process.env.ENABLE_COMPUTER_USE;

  afterEach(() => {
    if (originalEnabled === undefined) {
      delete process.env.COMPUTER_USE_ENABLED;
    } else {
      process.env.COMPUTER_USE_ENABLED = originalEnabled;
    }

    if (originalEnable === undefined) {
      delete process.env.ENABLE_COMPUTER_USE;
    } else {
      process.env.ENABLE_COMPUTER_USE = originalEnable;
    }
  });

  test('checkComputerUseDependencies returns platform information', async () => {
    process.env.COMPUTER_USE_ENABLED = '1';
    const diag = await checkComputerUseDependencies();
    expect(diag).toBeDefined();
    expect(diag.platform).toBe(process.platform);
    expect(diag.enabled).toBe(true);
    expect(Array.isArray(diag.dependencies)).toBe(true);

    if (process.platform === 'win32') {
      const powershellDep = diag.dependencies.find(d => d.name === 'powershell');
      expect(powershellDep).toBeDefined();
      expect(powershellDep?.type).toBe('required');
    } else if (process.platform === 'darwin') {
      const screencaptureDep = diag.dependencies.find(d => d.name === 'screencapture');
      const cliclickDep = diag.dependencies.find(d => d.name === 'cliclick');
      expect(screencaptureDep).toBeDefined();
      expect(cliclickDep).toBeDefined();
      expect(screencaptureDep?.type).toBe('required');
      expect(cliclickDep?.type).toBe('required');
    } else if (process.platform === 'linux') {
      const xdotoolDep = diag.dependencies.find(d => d.name === 'xdotool');
      expect(xdotoolDep).toBeDefined();
      expect(xdotoolDep?.type).toBe('required');
    }
  });
});
