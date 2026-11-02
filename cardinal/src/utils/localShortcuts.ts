export const CASE_SENSITIVE_SHORTCUT_STORAGE_KEY = 'hajimi.caseSensitiveShortcut';
export const DEFAULT_CASE_SENSITIVE_SHORTCUT = '';

const normalizeShortcut = (shortcut: string): string => shortcut.trim();

export const getStoredCaseSensitiveShortcut = (): string => {
  if (typeof window === 'undefined') {
    return DEFAULT_CASE_SENSITIVE_SHORTCUT;
  }

  try {
    return normalizeShortcut(
      window.localStorage.getItem(CASE_SENSITIVE_SHORTCUT_STORAGE_KEY) ??
        DEFAULT_CASE_SENSITIVE_SHORTCUT,
    );
  } catch {
    return DEFAULT_CASE_SENSITIVE_SHORTCUT;
  }
};

export const updateCaseSensitiveShortcut = (shortcutInput: string): void => {
  const shortcut = normalizeShortcut(shortcutInput);

  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (shortcut) {
      window.localStorage.setItem(CASE_SENSITIVE_SHORTCUT_STORAGE_KEY, shortcut);
    } else {
      window.localStorage.removeItem(CASE_SENSITIVE_SHORTCUT_STORAGE_KEY);
    }
  } catch {
    // Keep the in-memory preference usable when local storage is unavailable.
  }
};
