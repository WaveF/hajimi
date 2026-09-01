import { invoke } from '@tauri-apps/api/core';
import { register, unregister } from '@tauri-apps/plugin-global-shortcut';

export const GLOBAL_SHORTCUT_STORAGE_KEY = 'hajimi.globalShortcut';
export const DEFAULT_GLOBAL_SHORTCUT = '';

export type ShortcutPlatform = 'macos' | 'windows' | 'linux';

let registeredShortcut: string | null = null;
let pendingOperation: Promise<void> = Promise.resolve();

const normalizeShortcut = (shortcut: string): string => shortcut.trim();

const detectShortcutPlatform = (): ShortcutPlatform => {
  if (typeof navigator !== 'undefined') {
    const platform = `${navigator.platform} ${navigator.userAgent}`.toLowerCase();
    if (platform.includes('mac')) {
      return 'macos';
    }
    if (platform.includes('win')) {
      return 'windows';
    }
  }

  return 'linux';
};

const SHORTCUT_MODIFIER_LABELS: Record<ShortcutPlatform, Record<string, string>> = {
  macos: {
    CommandOrControl: 'Cmd',
    Command: 'Cmd',
    Control: 'Ctrl',
    Alt: 'Opt',
    Option: 'Opt',
    Shift: 'Shift',
    Super: 'Cmd',
  },
  windows: {
    CommandOrControl: 'Ctrl',
    Command: 'Win',
    Control: 'Ctrl',
    Alt: 'Alt',
    Option: 'Alt',
    Shift: 'Shift',
    Super: 'Win',
  },
  linux: {
    CommandOrControl: 'Ctrl',
    Command: 'Super',
    Control: 'Ctrl',
    Alt: 'Alt',
    Option: 'Alt',
    Shift: 'Shift',
    Super: 'Super',
  },
};

/** Formats Tauri's cross-platform accelerator syntax for a compact UI label. */
export const formatShortcutForDisplay = (
  shortcut: string,
  platform: ShortcutPlatform = detectShortcutPlatform(),
): string => {
  const labels = SHORTCUT_MODIFIER_LABELS[platform];
  return shortcut
    .split('+')
    .map((part) => labels[part] ?? part)
    .join('+');
};

export const getStoredGlobalShortcut = (): string => {
  if (typeof window === 'undefined') {
    return DEFAULT_GLOBAL_SHORTCUT;
  }

  try {
    return normalizeShortcut(
      window.localStorage.getItem(GLOBAL_SHORTCUT_STORAGE_KEY) ?? DEFAULT_GLOBAL_SHORTCUT,
    );
  } catch {
    return DEFAULT_GLOBAL_SHORTCUT;
  }
};

const persistGlobalShortcut = (shortcut: string): void => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (shortcut) {
      window.localStorage.setItem(GLOBAL_SHORTCUT_STORAGE_KEY, shortcut);
    } else {
      window.localStorage.removeItem(GLOBAL_SHORTCUT_STORAGE_KEY);
    }
  } catch {
    // Ignore storage failures; the active registration remains authoritative.
  }
};

const handleGlobalShortcut = (event: { state: string }): void => {
  if (event.state === 'Released') {
    void invoke('toggle_main_window');
  }
};

const enqueueOperation = <T>(operation: () => Promise<T>): Promise<T> => {
  const nextOperation = pendingOperation.then(operation, operation);
  pendingOperation = nextOperation.then(
    () => undefined,
    () => undefined,
  );
  return nextOperation;
};

/**
 * Registers the persisted global shortcut once during application startup.
 * An empty value intentionally leaves global shortcut support disabled.
 */
export async function initializeGlobalShortcuts(): Promise<void> {
  await enqueueOperation(async () => {
    const shortcut = getStoredGlobalShortcut();
    if (!shortcut) {
      return;
    }

    try {
      await register(shortcut, handleGlobalShortcut);
      registeredShortcut = shortcut;
    } catch (error) {
      console.error('Failed to register saved global shortcut', error);
    }
  });
}

/**
 * Updates the active global shortcut. If registration fails, the previous
 * shortcut is restored and the returned promise rejects without persisting the
 * unusable value.
 */
export function updateGlobalShortcut(shortcutInput: string): Promise<void> {
  const shortcut = normalizeShortcut(shortcutInput);

  return enqueueOperation(async () => {
    const previousShortcut = registeredShortcut;
    if (previousShortcut === shortcut) {
      persistGlobalShortcut(shortcut);
      return;
    }

    if (previousShortcut) {
      await unregister(previousShortcut);
      registeredShortcut = null;
    }

    if (!shortcut) {
      persistGlobalShortcut(DEFAULT_GLOBAL_SHORTCUT);
      return;
    }

    try {
      await register(shortcut, handleGlobalShortcut);
      registeredShortcut = shortcut;
      persistGlobalShortcut(shortcut);
    } catch (error) {
      if (previousShortcut) {
        try {
          await register(previousShortcut, handleGlobalShortcut);
          registeredShortcut = previousShortcut;
        } catch (restoreError) {
          console.error('Failed to restore previous global shortcut', restoreError);
        }
      }
      throw error;
    }
  });
}

const MODIFIER_KEYS = new Set(['Alt', 'Control', 'Meta', 'Shift']);

const KEY_CODE_NAMES: Record<string, string> = {
  Backquote: 'Backquote',
  Backslash: 'Backslash',
  BracketLeft: 'BracketLeft',
  BracketRight: 'BracketRight',
  Comma: 'Comma',
  Equal: 'Equal',
  Minus: 'Minus',
  Period: 'Period',
  Quote: 'Quote',
  Semicolon: 'Semicolon',
  Slash: 'Slash',
  Space: 'Space',
  Escape: 'Esc',
  Enter: 'Enter',
  Tab: 'Tab',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Insert: 'Insert',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  ArrowUp: 'ArrowUp',
  ArrowDown: 'ArrowDown',
  ArrowLeft: 'ArrowLeft',
  ArrowRight: 'ArrowRight',
  NumpadAdd: 'NumpadAdd',
  NumpadSubtract: 'NumpadSubtract',
  NumpadMultiply: 'NumpadMultiply',
  NumpadDivide: 'NumpadDivide',
  NumpadDecimal: 'NumpadDecimal',
  NumpadEnter: 'NumpadEnter',
  CapsLock: 'CapsLock',
  NumLock: 'NumLock',
  PrintScreen: 'PrintScreen',
  ScrollLock: 'ScrollLock',
  Pause: 'Pause',
};

const getAcceleratorKey = (event: KeyboardEvent): string | null => {
  if (MODIFIER_KEYS.has(event.key)) {
    return null;
  }

  const explicitName = KEY_CODE_NAMES[event.code];
  if (explicitName) {
    return explicitName;
  }

  if (/^Key[A-Z]$/.test(event.code)) {
    return event.code.slice(3);
  }
  if (/^Digit[0-9]$/.test(event.code)) {
    return event.code.slice(5);
  }
  if (/^Numpad[0-9]$/.test(event.code)) {
    return `Num${event.code.slice(6)}`;
  }
  if (/^F(?:[1-9]|1[0-9]|2[0-4])$/.test(event.code)) {
    return event.code;
  }

  return null;
};

/** Converts a browser key event into the accelerator syntax understood by Tauri. */
export const shortcutFromKeyboardEvent = (event: KeyboardEvent): string | null => {
  const key = getAcceleratorKey(event);
  if (!key) {
    return null;
  }

  const modifiers: string[] = [];
  if (event.metaKey || event.ctrlKey) {
    modifiers.push('CommandOrControl');
  }
  if (event.altKey) {
    modifiers.push('Alt');
  }
  if (event.shiftKey) {
    modifiers.push('Shift');
  }

  if (modifiers.length === 0) {
    return null;
  }

  return [...modifiers, key].join('+');
};
