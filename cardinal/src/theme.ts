export type ThemePreference = 'system' | 'light' | 'dark';

const THEME_STORAGE_KEY = 'hajimi.theme';

const isBrowser = typeof window !== 'undefined';
const isDocumentAvailable = typeof document !== 'undefined';

const isThemePreference = (value: string | null): value is ThemePreference =>
  value === 'system' || value === 'light' || value === 'dark';

const readStoredPreference = (): ThemePreference => {
  if (!isBrowser) {
    return 'system';
  }

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (isThemePreference(stored)) {
    return stored;
  }

  return 'system';
};

const writeStoredPreference = (preference: ThemePreference): void => {
  if (!isBrowser) return;

  window.localStorage.setItem(THEME_STORAGE_KEY, preference);
};

const clearStoredPreference = (): void => {
  if (!isBrowser) return;
  window.localStorage.removeItem(THEME_STORAGE_KEY);
};

const applyPreferenceToDocument = (preference: ThemePreference): void => {
  if (!isDocumentAvailable) {
    return;
  }

  const root = document.documentElement;
  if (!root) return;

  if (preference === 'system') {
    root.removeAttribute('data-theme');
    return;
  }

  root.setAttribute('data-theme', preference);
};

export const getStoredThemePreference = (): ThemePreference => readStoredPreference();

export const initializeThemePreference = (): ThemePreference => {
  const preference = readStoredPreference();
  applyPreferenceToDocument(preference);
  return preference;
};

export const persistThemePreference = (preference: ThemePreference): void => {
  if (preference === 'system') {
    clearStoredPreference();
  } else {
    writeStoredPreference(preference);
  }
};

export const applyThemePreference = (preference: ThemePreference): void => {
  applyPreferenceToDocument(preference);
};
