import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_HIDE_EMPTY_RESULTS,
  DEFAULT_REFRESH_EVENTS_ONLY_WHEN_ACTIVE,
  HIDE_EMPTY_RESULTS_STORAGE_KEY,
  REFRESH_EVENTS_ONLY_WHEN_ACTIVE_STORAGE_KEY,
  useSearchDisplayPreferences,
} from '../useSearchDisplayPreferences';

describe('useSearchDisplayPreferences', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('defaults both display preferences to enabled', () => {
    const { result } = renderHook(() => useSearchDisplayPreferences());

    expect(result.current.hideEmptyResults).toBe(DEFAULT_HIDE_EMPTY_RESULTS);
    expect(result.current.refreshEventsOnlyWhenActive).toBe(
      DEFAULT_REFRESH_EVENTS_ONLY_WHEN_ACTIVE,
    );
  });

  it('persists changes and restores the defaults on reset', () => {
    const { result } = renderHook(() => useSearchDisplayPreferences());

    act(() => {
      result.current.setHideEmptyResults(false);
      result.current.setRefreshEventsOnlyWhenActive(false);
    });

    expect(window.localStorage.getItem(HIDE_EMPTY_RESULTS_STORAGE_KEY)).toBe('false');
    expect(window.localStorage.getItem(REFRESH_EVENTS_ONLY_WHEN_ACTIVE_STORAGE_KEY)).toBe('false');

    act(() => {
      result.current.resetSearchDisplayPreferences();
    });

    expect(result.current.hideEmptyResults).toBe(true);
    expect(result.current.refreshEventsOnlyWhenActive).toBe(true);
    expect(window.localStorage.getItem(HIDE_EMPTY_RESULTS_STORAGE_KEY)).toBe('true');
    expect(window.localStorage.getItem(REFRESH_EVENTS_ONLY_WHEN_ACTIVE_STORAGE_KEY)).toBe('true');
  });
});
