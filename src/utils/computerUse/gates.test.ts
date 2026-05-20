import { describe, expect, test, afterEach } from 'bun:test';
import { getChicagoEnabled } from './gates.js';

describe('computerUse gates', () => {
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

  test('getChicagoEnabled respects COMPUTER_USE_ENABLED=1', () => {
    process.env.COMPUTER_USE_ENABLED = '1';
    delete process.env.ENABLE_COMPUTER_USE;
    expect(getChicagoEnabled()).toBe(true);
  });

  test('getChicagoEnabled respects ENABLE_COMPUTER_USE=1', () => {
    delete process.env.COMPUTER_USE_ENABLED;
    process.env.ENABLE_COMPUTER_USE = '1';
    expect(getChicagoEnabled()).toBe(true);
  });

  test('getChicagoEnabled respects COMPUTER_USE_ENABLED=0', () => {
    process.env.COMPUTER_USE_ENABLED = '0';
    delete process.env.ENABLE_COMPUTER_USE;
    expect(getChicagoEnabled()).toBe(false);
  });

  test('getChicagoEnabled respects ENABLE_COMPUTER_USE=0', () => {
    delete process.env.COMPUTER_USE_ENABLED;
    process.env.ENABLE_COMPUTER_USE = '0';
    expect(getChicagoEnabled()).toBe(false);
  });
});
