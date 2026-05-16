/**
 * Tests for spawnMultiAgent.ts — resolveTeammateModel function.
 *
 * Uses dynamic import to ensure env vars are set BEFORE the module graph loads.
 */

import { beforeAll, describe, expect, test } from 'bun:test';
import { enableConfigs } from '../../utils/config.js';

let resolveTeammateModel: typeof import('./spawnMultiAgent.js')['resolveTeammateModel'];

beforeAll(async () => {
  // Set dummy API key to satisfy module load-time auth guard
  process.env.ANTHROPIC_API_KEY ??= 'test-key';
  enableConfigs();
  const mod = await import('./spawnMultiAgent.js');
  resolveTeammateModel = mod.resolveTeammateModel;
});

describe('resolveTeammateModel', () => {
  test('returns input model when explicitly provided (not "inherit")', () => {
    expect(resolveTeammateModel('claude-sonnet-4-6', 'claude-opus-4-6')).toBe('claude-sonnet-4-6');
  });

  test('resolves "inherit" to leader model when leader model is set', () => {
    expect(resolveTeammateModel('inherit', 'claude-opus-4-6')).toBe('claude-opus-4-6');
  });

  test('resolves undefined to default model string', () => {
    const result = resolveTeammateModel(undefined, 'claude-opus-4-6');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  test('resolves undefined when leader model is null', () => {
    const result = resolveTeammateModel(undefined, null);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  test('resolves "inherit" when leader model is null', () => {
    const result = resolveTeammateModel('inherit', null);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  test('passes through custom model name', () => {
    expect(resolveTeammateModel('gpt-5', 'claude-opus-4-6')).toBe('gpt-5');
  });
});
