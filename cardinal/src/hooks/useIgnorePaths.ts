import { useCallback, useEffect } from 'react';
import { useStoredState } from './useStoredState';

const STORAGE_KEY = 'hajimi.ignorePaths';
const DEFAULTS_VERSION_KEY = 'hajimi.ignorePathsDefaultsVersion';
const DEFAULTS_VERSION = '2';
// Ignore generated, disposable, or high-churn macOS paths by default:
// - `/Volumes` can include external drives and network mounts that are large or slow to traverse.
// - `~/Library/CloudStorage` can contain cloud stubs that trigger downloads or network I/O.
// - `~/Library/Biome` stores system suggestions/activity data rather than user-authored files.
// - `~/Library/Caches`, `~/Library/Logs`, and `~/Library/Metadata` are cache/log/metadata stores rather than user-authored files.
// - `/Library/Caches` and `/System/Library/Caches` are transient system caches with low search value.
// - `/private/var` is a broad system runtime area for temp files, caches, logs, and databases.
// - `/private/tmp` is a temporary-file area with very high churn and little search value.
// - Common development dependency/build directories are large and usually not useful in file search.
const LEGACY_DEFAULT_IGNORE_PATHS = [
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
];

const DEVELOPMENT_IGNORE_PATHS = ['node_modules/', '.venv/', '__pycache__/', '.git/'];

const DEFAULT_IGNORE_PATHS = [...LEGACY_DEFAULT_IGNORE_PATHS, ...DEVELOPMENT_IGNORE_PATHS];

const cleanPaths = (next: string[]): string[] =>
  next.map((item) => item.trim()).filter((item) => item.length > 0);

export function useIgnorePaths() {
  const [ignorePaths, setIgnorePathsState] = useStoredState<string[]>({
    key: STORAGE_KEY,
    defaultValue: DEFAULT_IGNORE_PATHS,
    read: (raw) => {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return null;
      return cleanPaths(parsed.filter((item): item is string => typeof item === 'string'));
    },
    write: (value) => JSON.stringify(value),
    readErrorMessage: 'Unable to read saved ignore paths',
    writeErrorMessage: 'Unable to persist default ignore paths',
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (window.localStorage.getItem(DEFAULTS_VERSION_KEY) === DEFAULTS_VERSION) {
      return;
    }

    // Migrate only an untouched legacy default list. Custom user rules, including
    // an intentionally empty list, must not be overwritten or augmented.
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed = raw == null ? null : JSON.parse(raw);
      const storedPaths = Array.isArray(parsed)
        ? cleanPaths(parsed.filter((item): item is string => typeof item === 'string'))
        : null;
      const isLegacyDefaultList =
        storedPaths != null &&
        storedPaths.length === LEGACY_DEFAULT_IGNORE_PATHS.length &&
        LEGACY_DEFAULT_IGNORE_PATHS.every((path) => storedPaths.includes(path));

      if (isLegacyDefaultList) {
        setIgnorePathsState([...storedPaths, ...DEVELOPMENT_IGNORE_PATHS]);
      }
    } catch (error) {
      console.warn('Unable to migrate default ignore paths', error);
    }

    try {
      window.localStorage.setItem(DEFAULTS_VERSION_KEY, DEFAULTS_VERSION);
    } catch (error) {
      console.warn('Unable to persist ignore path defaults version', error);
    }
  }, [setIgnorePathsState]);

  const setIgnorePaths = useCallback(
    (next: string[]) => {
      const cleaned = cleanPaths(next);
      setIgnorePathsState(cleaned);
    },
    [setIgnorePathsState],
  );

  return { ignorePaths, setIgnorePaths, defaultIgnorePaths: DEFAULT_IGNORE_PATHS };
}
