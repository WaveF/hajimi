import { useCallback, useState } from 'react';

export const HIDE_EMPTY_RESULTS_STORAGE_KEY = 'hajimi.search.hideEmptyResults';
export const REFRESH_EVENTS_ONLY_WHEN_ACTIVE_STORAGE_KEY =
  'hajimi.search.refreshEventsOnlyWhenActive';

export const DEFAULT_HIDE_EMPTY_RESULTS = true;
export const DEFAULT_REFRESH_EVENTS_ONLY_WHEN_ACTIVE = true;

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

  const setHideEmptyResults = useCallback((enabled: boolean) => {
    setHideEmptyResultsState(enabled);
    persistBoolean(HIDE_EMPTY_RESULTS_STORAGE_KEY, enabled);
  }, []);

  const setRefreshEventsOnlyWhenActive = useCallback((enabled: boolean) => {
    setRefreshEventsOnlyWhenActiveState(enabled);
    persistBoolean(REFRESH_EVENTS_ONLY_WHEN_ACTIVE_STORAGE_KEY, enabled);
  }, []);

  const resetSearchDisplayPreferences = useCallback(() => {
    setHideEmptyResultsState(DEFAULT_HIDE_EMPTY_RESULTS);
    setRefreshEventsOnlyWhenActiveState(DEFAULT_REFRESH_EVENTS_ONLY_WHEN_ACTIVE);
    persistBoolean(HIDE_EMPTY_RESULTS_STORAGE_KEY, DEFAULT_HIDE_EMPTY_RESULTS);
    persistBoolean(
      REFRESH_EVENTS_ONLY_WHEN_ACTIVE_STORAGE_KEY,
      DEFAULT_REFRESH_EVENTS_ONLY_WHEN_ACTIVE,
    );
  }, []);

  return {
    hideEmptyResults,
    setHideEmptyResults,
    refreshEventsOnlyWhenActive,
    setRefreshEventsOnlyWhenActive,
    resetSearchDisplayPreferences,
  };
}
