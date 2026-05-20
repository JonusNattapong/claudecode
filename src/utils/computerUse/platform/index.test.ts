import { describe, expect, test } from 'bun:test';
import { getPlatformAdapter } from './index.js';

describe('platform adapter factory', () => {
  test('getPlatformAdapter returns adapter for current platform', () => {
    const adapter = getPlatformAdapter();
    expect(adapter).toBeDefined();
    expect(adapter.platform).toBe(process.platform === 'win32' ? 'win32' : process.platform === 'darwin' ? 'darwin' : 'linux');
  }, 20000);

  test('adapter.getDisplaySize returns valid geometry', async () => {
    const adapter = getPlatformAdapter();
    const size = await adapter.getDisplaySize();
    expect(size).toBeDefined();
    expect(typeof size.width).toBe('number');
    expect(typeof size.height).toBe('number');
    expect(size.width).toBeGreaterThan(0);
    expect(size.height).toBeGreaterThan(0);
  }, 20000);

  test('adapter.listDisplays returns array of geometries', async () => {
    const adapter = getPlatformAdapter();
    const displays = await adapter.listDisplays();
    expect(displays).toBeDefined();
    expect(Array.isArray(displays)).toBe(true);
    expect(displays.length).toBeGreaterThan(0);
    expect(displays[0]?.width).toBeGreaterThan(0);
  }, 20000);
});

