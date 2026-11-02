import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useIgnorePaths } from '../useIgnorePaths';

const STORAGE_KEY = 'hajimi.ignorePaths';
const EXPECTED_DEFAULT_IGNORE_PATHS = [
  '/Volumes',
  '~/Library/CloudStorage',
  '~/Library/Biome',
  '~/Library/Caches',
  '~/Library/Logs',
  '~/Library/Metadata',
  '/Library/Caches',
  '/System/Library/Caches',
  '/private/var',
  '/private/tmp',
  'node_modules/',
  '.venv/',
  '__pycache__/',
  '.git/',
];

const flushEffects = async () => {
  await act(async () => {});
};

describe('useIgnorePaths', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hydrates from stored values and filters invalid entries', async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([' /tmp ', '', 42, '   ', '/var']));
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    const { result } = renderHook(() => useIgnorePaths());

    expect(result.current.ignorePaths).toEqual(['/tmp', '/var']);

    await flushEffects();

    expect(setItemSpy).not.toHaveBeenCalledWith(STORAGE_KEY, expect.anything());
  });

  it('uses defaults and persists when no stored value exists', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    const { result } = renderHook(() => useIgnorePaths());

    expect(result.current.ignorePaths).toEqual(EXPECTED_DEFAULT_IGNORE_PATHS);
    expect(result.current.defaultIgnorePaths).toEqual(EXPECTED_DEFAULT_IGNORE_PATHS);

    await flushEffects();

    expect(setItemSpy).toHaveBeenCalledWith(
      STORAGE_KEY,
      JSON.stringify(EXPECTED_DEFAULT_IGNORE_PATHS),
    );
  });

  it('includes cache, biome, logs, metadata, and system runtime folders in default ignore paths', () => {
    const { result } = renderHook(() => useIgnorePaths());

    expect(result.current.defaultIgnorePaths).toContain('~/Library/CloudStorage');
    expect(result.current.defaultIgnorePaths).toContain('~/Library/Caches');
    expect(result.current.defaultIgnorePaths).toContain('/Library/Caches');
    expect(result.current.defaultIgnorePaths).toContain('/System/Library/Caches');
    expect(result.current.defaultIgnorePaths).toContain('~/Library/Biome');
    expect(result.current.defaultIgnorePaths).toContain('~/Library/Logs');
    expect(result.current.defaultIgnorePaths).toContain('~/Library/Metadata');
    expect(result.current.defaultIgnorePaths).toContain('/private/var');
    expect(result.current.defaultIgnorePaths).toContain('/private/tmp');
    expect(result.current.defaultIgnorePaths).toContain('node_modules/');
    expect(result.current.defaultIgnorePaths).toContain('.venv/');
    expect(result.current.defaultIgnorePaths).toContain('__pycache__/');
    expect(result.current.defaultIgnorePaths).toContain('.git/');
  });

  it('migrates an untouched legacy default list with development directories once', async () => {
    const legacyDefaults = EXPECTED_DEFAULT_IGNORE_PATHS.slice(0, 10);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(legacyDefaults));

    const { result } = renderHook(() => useIgnorePaths());

    await flushEffects();

    expect(result.current.ignorePaths).toEqual(EXPECTED_DEFAULT_IGNORE_PATHS);
    expect(window.localStorage.getItem('hajimi.ignorePathsDefaultsVersion')).toBe('2');
  });

  it('keeps an empty stored array without writing defaults', async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(['', '   ']));
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    const { result } = renderHook(() => useIgnorePaths());

    expect(result.current.ignorePaths).toEqual([]);

    await flushEffects();

    expect(setItemSpy).not.toHaveBeenCalledWith(STORAGE_KEY, expect.anything());
  });

  it('cleans and persists updates', async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    const { result } = renderHook(() => useIgnorePaths());

    await flushEffects();

    act(() => {
      result.current.setIgnorePaths([' /tmp ', '', '/var', '   ']);
    });

    expect(result.current.ignorePaths).toEqual(['/tmp', '/var']);
    expect(setItemSpy).toHaveBeenCalledWith(STORAGE_KEY, JSON.stringify(['/tmp', '/var']));
  });

  it('falls back to defaults when stored JSON is invalid', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    window.localStorage.setItem(STORAGE_KEY, '{');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    const { result } = renderHook(() => useIgnorePaths());

    expect(result.current.ignorePaths).toEqual(result.current.defaultIgnorePaths);

    await flushEffects();

    expect(setItemSpy).toHaveBeenCalledWith(
      STORAGE_KEY,
      JSON.stringify(result.current.defaultIgnorePaths),
    );
    warnSpy.mockRestore();
  });
});
