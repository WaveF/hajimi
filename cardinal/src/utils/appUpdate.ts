export const GITHUB_REPOSITORY_URL = 'https://github.com/WaveF/hajimi';
export const GITHUB_RELEASES_URL = `${GITHUB_REPOSITORY_URL}/releases`;
export const ORIGINAL_CARDINAL_URL = 'https://github.com/cardisoft/cardinal';
export const UPDATE_MANIFEST_URL =
  'https://raw.githubusercontent.com/WaveF/hajimi/master/latest.json';
export const GITHUB_LATEST_RELEASE_API_URL =
  'https://api.github.com/repos/WaveF/hajimi/releases/latest';

export type UpdateCheckFrequency = 'daily' | 'weekly' | 'monthly';

export type UpdateManifest = {
  version: string;
  releaseUrl: string;
};

export type UpdateCheckResult =
  | { status: 'up-to-date'; manifest: UpdateManifest }
  | { status: 'available'; manifest: UpdateManifest }
  | { status: 'error'; message: string };

const VERSION_PATTERN = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:[-+].*)?$/i;

export const compareVersions = (left: string, right: string): number => {
  const parse = (value: string): number[] => {
    const match = value.trim().match(VERSION_PATTERN);
    if (!match) return [0];
    return [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)];
  };

  const leftParts = parse(left);
  const rightParts = parse(right);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] > rightParts[index] ? 1 : -1;
    }
  }
  return 0;
};

const isGitHubReleaseUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'github.com';
  } catch {
    return false;
  }
};

export const parseUpdateManifest = (value: unknown): UpdateManifest => {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid update manifest');
  }

  const candidate = value as { version?: unknown; releaseUrl?: unknown };
  if (typeof candidate.version !== 'string' || !VERSION_PATTERN.test(candidate.version.trim())) {
    throw new Error('Invalid update version');
  }

  const version = candidate.version.trim().replace(/^v/i, '');
  const releaseUrl =
    typeof candidate.releaseUrl === 'string' && isGitHubReleaseUrl(candidate.releaseUrl)
      ? candidate.releaseUrl
      : `${GITHUB_RELEASES_URL}/tag/v${version}`;

  return { version, releaseUrl };
};

export async function checkForLatestUpdate(
  currentVersion: string,
  signal?: AbortSignal,
): Promise<UpdateCheckResult> {
  try {
    const response = await fetch(UPDATE_MANIFEST_URL, {
      cache: 'no-store',
      signal,
      headers: { Accept: 'application/json' },
    });
    if (response.ok) {
      const manifest = parseUpdateManifest(await response.json());
      return compareVersions(manifest.version, currentVersion) > 0
        ? { status: 'available', manifest }
        : { status: 'up-to-date', manifest };
    }

    if (response.status !== 404) {
      throw new Error(`Update manifest request failed with ${response.status}`);
    }

    // Keep the manifest as the primary source, but fall back to GitHub's public
    // release endpoint while a newly added manifest has not reached the default branch.
    const releaseResponse = await fetch(GITHUB_LATEST_RELEASE_API_URL, {
      cache: 'no-store',
      signal,
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!releaseResponse.ok) {
      throw new Error(`GitHub release request failed with ${releaseResponse.status}`);
    }

    const release = (await releaseResponse.json()) as {
      tag_name?: unknown;
      html_url?: unknown;
    };
    const manifest = parseUpdateManifest({
      version: release.tag_name,
      releaseUrl: release.html_url,
    });
    return compareVersions(manifest.version, currentVersion) > 0
      ? { status: 'available', manifest }
      : { status: 'up-to-date', manifest };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown update error',
    };
  }
}

export const UPDATE_FREQUENCY_DURATIONS: Record<UpdateCheckFrequency, number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
};

export const isUpdateCheckDue = (
  lastCheckedAt: number | null,
  frequency: UpdateCheckFrequency,
  now = Date.now(),
): boolean =>
  lastCheckedAt === null || now - lastCheckedAt >= UPDATE_FREQUENCY_DURATIONS[frequency];
