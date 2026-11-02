import { useCallback, useState } from 'react';
import {
  DEFAULT_CASE_SENSITIVE_SHORTCUT,
  getStoredCaseSensitiveShortcut,
  updateCaseSensitiveShortcut,
} from '../utils/localShortcuts';

export const HIDE_EMPTY_RESULTS_STORAGE_KEY = 'hajimi.search.hideEmptyResults';
export const REFRESH_EVENTS_ONLY_WHEN_ACTIVE_STORAGE_KEY =
  'hajimi.search.refreshEventsOnlyWhenActive';
export const OPEN_DIRECTORY_ON_PATH_DOUBLE_CLICK_STORAGE_KEY =
  'hajimi.search.openDirectoryOnPathDoubleClick';

export const DEFAULT_HIDE_EMPTY_RESULTS = true;
export const DEFAULT_REFRESH_EVENTS_ONLY_WHEN_ACTIVE = true;
export const DEFAULT_OPEN_DIRECTORY_ON_PATH_DOUBLE_CLICK = true;

const readStoredBoolean = (key: string, defaultValue: boolean): boolean => {
  if (typeof window === 'undefined') {
    return defaultValue;
  }

  try {
    const stored = window.localStorage.getItem(key);
    return stored == null ? defaultValue : stored === 'true';
  } catch {
    return defaultValue;
  }
};

const persistBoolean = (key: string, value: boolean): void => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(key, value ? 'true' : 'false');
  } catch {
    // Ignore storage failures; the in-memory preference remains authoritative.
  }
};

export type SearchDisplayPreferences = {
  hideEmptyResults: boolean;
  setHideEmptyResults: (enabled: boolean) => void;
  refreshEventsOnlyWhenActive: boolean;
  setRefreshEventsOnlyWhenActive: (enabled: boolean) => void;
  openDirectoryOnPathDoubleClick: boolean;
  setOpenDirectoryOnPathDoubleClick: (enabled: boolean) => void;
  caseSensitiveShortcut: string;
  defaultCaseSensitiveShortcut: string;
  setCaseSensitiveShortcut: (shortcut: string) => void;
  resetSearchDisplayPreferences: () => void;
};

export function useSearchDisplayPreferences(): SearchDisplayPreferences {
  const [hideEmptyResults, setHideEmptyResultsState] = useState(() =>
    readStoredBoolean(HIDE_EMPTY_RESULTS_STORAGE_KEY, DEFAULT_HIDE_EMPTY_RESULTS),
  );
  const [refreshEventsOnlyWhenActive, setRefreshEventsOnlyWhenActiveState] = useState(() =>
    readStoredBoolean(
      REFRESH_EVENTS_ONLY_WHEN_ACTIVE_STORAGE_KEY,
      DEFAULT_REFRESH_EVENTS_ONLY_WHEN_ACTIVE,
    ),
  );
  const [openDirectoryOnPathDoubleClick, setOpenDirectoryOnPathDoubleClickState] = useState(() =>
    readStoredBoolean(
      OPEN_DIRECTORY_ON_PATH_DOUBLE_CLICK_STORAGE_KEY,
      DEFAULT_OPEN_DIRECTORY_ON_PATH_DOUBLE_CLICK,
    ),
  );
  const [caseSensitiveShortcut, setCaseSensitiveShortcutState] = useState(() =>
    getStoredCaseSensitiveShortcut(),
  );

  const setHideEmptyResults = useCallback((enabled: boolean) => {
    setHideEmptyResultsState(enabled);
    persistBoolean(HIDE_EMPTY_RESULTS_STORAGE_KEY, enabled);
  }, []);

  const setRefreshEventsOnlyWhenActive = useCallback((enabled: boolean) => {
    setRefreshEventsOnlyWhenActiveState(enabled);
    persistBoolean(REFRESH_EVENTS_ONLY_WHEN_ACTIVE_STORAGE_KEY, enabled);
  }, []);

  const setOpenDirectoryOnPathDoubleClick = useCallback((enabled: boolean) => {
    setOpenDirectoryOnPathDoubleClickState(enabled);
    persistBoolean(OPEN_DIRECTORY_ON_PATH_DOUBLE_CLICK_STORAGE_KEY, enabled);
  }, []);

  const setCaseSensitiveShortcut = useCallback((shortcutInput: string) => {
    const shortcut = shortcutInput.trim();
    updateCaseSensitiveShortcut(shortcut);
    setCaseSensitiveShortcutState(shortcut);
  }, []);

  const resetSearchDisplayPreferences = useCallback(() => {
    setHideEmptyResultsState(DEFAULT_HIDE_EMPTY_RESULTS);
    setRefreshEventsOnlyWhenActiveState(DEFAULT_REFRESH_EVENTS_ONLY_WHEN_ACTIVE);
    setOpenDirectoryOnPathDoubleClickState(DEFAULT_OPEN_DIRECTORY_ON_PATH_DOUBLE_CLICK);
    setCaseSensitiveShortcutState(DEFAULT_CASE_SENSITIVE_SHORTCUT);
    persistBoolean(HIDE_EMPTY_RESULTS_STORAGE_KEY, DEFAULT_HIDE_EMPTY_RESULTS);
    persistBoolean(
      REFRESH_EVENTS_ONLY_WHEN_ACTIVE_STORAGE_KEY,
      DEFAULT_REFRESH_EVENTS_ONLY_WHEN_ACTIVE,
    );
    persistBoolean(
      OPEN_DIRECTORY_ON_PATH_DOUBLE_CLICK_STORAGE_KEY,
      DEFAULT_OPEN_DIRECTORY_ON_PATH_DOUBLE_CLICK,
    );
    updateCaseSensitiveShortcut(DEFAULT_CASE_SENSITIVE_SHORTCUT);
  }, []);

  return {
    hideEmptyResults,
    setHideEmptyResults,
    refreshEventsOnlyWhenActive,
    setRefreshEventsOnlyWhenActive,
    openDirectoryOnPathDoubleClick,
    setOpenDirectoryOnPathDoubleClick,
    caseSensitiveShortcut,
    defaultCaseSensitiveShortcut: DEFAULT_CASE_SENSITIVE_SHORTCUT,
    setCaseSensitiveShortcut,
    resetSearchDisplayPreferences,
  };
}
