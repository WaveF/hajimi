import { useCallback, useEffect, useRef, useState } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import {
  checkForLatestUpdate,
  isUpdateCheckDue,
  type UpdateCheckFrequency,
  type UpdateCheckResult,
  type UpdateManifest,
} from '../utils/appUpdate';

const AUTO_UPDATE_STORAGE_KEY = 'hajimi.update.autoCheckEnabled';
const UPDATE_FREQUENCY_STORAGE_KEY = 'hajimi.update.checkFrequency';
const LAST_UPDATE_CHECK_STORAGE_KEY = 'hajimi.update.lastCheckedAt';
const DEFAULT_FREQUENCY: UpdateCheckFrequency = 'weekly';

const readBoolean = (key: string, fallback: boolean): boolean => {
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? fallback : value === 'true';
  } catch {
    return fallback;
  }
};

const readFrequency = (): UpdateCheckFrequency => {
  try {
    const value = window.localStorage.getItem(UPDATE_FREQUENCY_STORAGE_KEY);
    return value === 'daily' || value === 'monthly' || value === 'weekly'
      ? value
      : DEFAULT_FREQUENCY;
  } catch {
    return DEFAULT_FREQUENCY;
  }
};

const readLastCheckedAt = (): number | null => {
  try {
    const value = window.localStorage.getItem(LAST_UPDATE_CHECK_STORAGE_KEY);
    if (!value) return null;
    const timestamp = Number(value);
    return Number.isFinite(timestamp) ? timestamp : null;
  } catch {
    return null;
  }
};

const persist = (key: string, value: string | null): void => {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // The update checker remains usable when local storage is unavailable.
  }
};

export type AppUpdateState = {
  status: 'idle' | 'checking' | 'up-to-date' | 'available' | 'error';
  manifest: UpdateManifest | null;
  error: string | null;
  lastCheckedAt: number | null;
};

type UseAppUpdateResult = {
  appVersion: string;
  autoUpdateEnabled: boolean;
  setAutoUpdateEnabled: (enabled: boolean) => void;
  updateCheckFrequency: UpdateCheckFrequency;
  setUpdateCheckFrequency: (frequency: UpdateCheckFrequency) => void;
  resetUpdatePreferences: () => void;
  updateState: AppUpdateState;
  checkForUpdates: () => Promise<void>;
};

const INITIAL_STATE: AppUpdateState = {
  status: 'idle',
  manifest: null,
  error: null,
  lastCheckedAt: null,
};

export function useAppUpdate(): UseAppUpdateResult {
  const [appVersion, setAppVersion] = useState('0.1.23');
  const [autoUpdateEnabled, setAutoUpdateEnabledState] = useState(() =>
    readBoolean(AUTO_UPDATE_STORAGE_KEY, true),
  );
  const [updateCheckFrequency, setUpdateCheckFrequencyState] =
    useState<UpdateCheckFrequency>(readFrequency);
  const [updateState, setUpdateState] = useState<AppUpdateState>(() => ({
    ...INITIAL_STATE,
    lastCheckedAt: readLastCheckedAt(),
  }));
  const requestIdRef = useRef(0);

  useEffect(() => {
    void getVersion()
      .then((version) => setAppVersion(version))
      .catch(() => undefined);
  }, []);

  const setAutoUpdateEnabled = useCallback((enabled: boolean) => {
    setAutoUpdateEnabledState(enabled);
    persist(AUTO_UPDATE_STORAGE_KEY, String(enabled));
  }, []);

  const setUpdateCheckFrequency = useCallback((frequency: UpdateCheckFrequency) => {
    setUpdateCheckFrequencyState(frequency);
    persist(UPDATE_FREQUENCY_STORAGE_KEY, frequency);
  }, []);

  const resetUpdatePreferences = useCallback(() => {
    setAutoUpdateEnabledState(true);
    setUpdateCheckFrequencyState(DEFAULT_FREQUENCY);
    persist(AUTO_UPDATE_STORAGE_KEY, 'true');
    persist(UPDATE_FREQUENCY_STORAGE_KEY, DEFAULT_FREQUENCY);
    persist(LAST_UPDATE_CHECK_STORAGE_KEY, null);
    setUpdateState({ ...INITIAL_STATE, lastCheckedAt: null });
  }, []);

  const checkForUpdates = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8_000);
    setUpdateState((previous) => ({ ...previous, status: 'checking', error: null }));

    try {
      const result: UpdateCheckResult = await checkForLatestUpdate(appVersion, controller.signal);
      if (requestIdRef.current !== requestId) return;
      const checkedAt = Date.now();
      persist(LAST_UPDATE_CHECK_STORAGE_KEY, String(checkedAt));
      setUpdateState({
        status: result.status,
        manifest: result.status === 'error' ? null : result.manifest,
        error: result.status === 'error' ? result.message : null,
        lastCheckedAt: checkedAt,
      });
    } catch (error) {
      if (requestIdRef.current !== requestId) return;
      if (error instanceof DOMException && error.name === 'AbortError') {
        setUpdateState((previous) => ({
          ...previous,
          status: 'error',
          error: 'Request timed out',
        }));
      } else {
        setUpdateState((previous) => ({
          ...previous,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown update error',
        }));
      }
    } finally {
      window.clearTimeout(timeout);
    }
  }, [appVersion]);

  useEffect(() => {
    if (!autoUpdateEnabled || !isUpdateCheckDue(updateState.lastCheckedAt, updateCheckFrequency)) {
      return;
    }

    const timer = window.setTimeout(() => void checkForUpdates(), 1_500);
    return () => window.clearTimeout(timer);
  }, [autoUpdateEnabled, checkForUpdates, updateCheckFrequency, updateState.lastCheckedAt]);

  return {
    appVersion,
    autoUpdateEnabled,
    setAutoUpdateEnabled,
    updateCheckFrequency,
    setUpdateCheckFrequency,
    resetUpdatePreferences,
    updateState,
    checkForUpdates,
  };
}
