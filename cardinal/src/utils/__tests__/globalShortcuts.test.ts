import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import {
  DEFAULT_GLOBAL_SHORTCUT,
  formatShortcutForDisplay,
  getStoredGlobalShortcut,
  shortcutFromKeyboardEvent,
  updateGlobalShortcut,
} from '../globalShortcuts';
import { register, unregister } from '@tauri-apps/plugin-global-shortcut';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-global-shortcut', () => ({
  register: vi.fn(),
  unregister: vi.fn(),
}));

const mockedInvoke = vi.mocked(invoke);
const mockedRegister = vi.mocked(register);
const mockedUnregister = vi.mocked(unregister);

describe('global shortcuts', () => {
  beforeEach(async () => {
    await updateGlobalShortcut(DEFAULT_GLOBAL_SHORTCUT);
    window.localStorage.clear();
    vi.clearAllMocks();
    mockedRegister.mockResolvedValue(undefined);
    mockedUnregister.mockResolvedValue(undefined);
    mockedInvoke.mockResolvedValue(undefined);
  });

  it('keeps the default shortcut disabled and persists configured shortcuts', async () => {
    expect(getStoredGlobalShortcut()).toBe('');

    await updateGlobalShortcut(' CommandOrControl+Shift+K ');

    expect(mockedRegister).toHaveBeenCalledTimes(1);
    expect(mockedRegister.mock.calls[0]?.[0]).toBe('CommandOrControl+Shift+K');
    expect(getStoredGlobalShortcut()).toBe('CommandOrControl+Shift+K');
  });

  it('unregisters a configured shortcut when cleared', async () => {
    await updateGlobalShortcut('CommandOrControl+Shift+K');
    mockedRegister.mockClear();

    await updateGlobalShortcut('');

    expect(mockedUnregister).toHaveBeenCalledWith('CommandOrControl+Shift+K');
    expect(getStoredGlobalShortcut()).toBe('');
  });

  it('returns the previous shortcut when the new registration fails', async () => {
    await updateGlobalShortcut('CommandOrControl+Shift+K');
    mockedRegister.mockClear();
    mockedRegister.mockRejectedValueOnce(new Error('already registered'));

    await expect(updateGlobalShortcut('CommandOrControl+Shift+L')).rejects.toThrow(
      'already registered',
    );

    expect(mockedRegister).toHaveBeenCalledTimes(2);
    expect(getStoredGlobalShortcut()).toBe('CommandOrControl+Shift+K');
  });

  it('converts browser key events into Tauri accelerator syntax', () => {
    const event = new KeyboardEvent('keydown', {
      code: 'KeyK',
      key: 'k',
      metaKey: true,
      shiftKey: true,
    });

    expect(shortcutFromKeyboardEvent(event)).toBe('CommandOrControl+Shift+K');
    expect(
      shortcutFromKeyboardEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft', key: 'Shift' })),
    ).toBeNull();
    expect(
      shortcutFromKeyboardEvent(new KeyboardEvent('keydown', { code: 'KeyK', key: 'k' })),
    ).toBeNull();
  });

  it('formats accelerator modifiers with platform-specific compact labels', () => {
    const shortcut = 'CommandOrControl+Alt+Shift+F4';

    expect(formatShortcutForDisplay(shortcut, 'macos')).toBe('Cmd+Opt+Shift+F4');
    expect(formatShortcutForDisplay(shortcut, 'windows')).toBe('Ctrl+Alt+Shift+F4');
    expect(formatShortcutForDisplay(shortcut, 'linux')).toBe('Ctrl+Alt+Shift+F4');
  });
});
