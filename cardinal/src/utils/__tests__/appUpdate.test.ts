import { describe, expect, it, vi } from 'vitest';
import {
  checkForLatestUpdate,
  compareVersions,
  isUpdateCheckDue,
  parseUpdateManifest,
} from '../appUpdate';

describe('app update helpers', () => {
  it('compares release versions numerically', () => {
    expect(compareVersions('0.1.24', '0.1.23')).toBe(1);
    expect(compareVersions('v1.2.0', '1.2')).toBe(0);
    expect(compareVersions('1.1.9', '1.2.0')).toBe(-1);
  });

  it('normalizes a manifest and derives a release URL when needed', () => {
    expect(parseUpdateManifest({ version: 'v0.1.24' })).toEqual({
      version: '0.1.24',
      releaseUrl: 'https://github.com/WaveF/hajimi/releases/tag/v0.1.24',
    });
  });

  it('rejects malformed manifests', () => {
    expect(() => parseUpdateManifest({ version: 'latest' })).toThrow('Invalid update version');
  });

  it('checks due dates using the selected frequency', () => {
    const now = Date.UTC(2026, 0, 8);
    expect(isUpdateCheckDue(null, 'weekly', now)).toBe(true);
    expect(isUpdateCheckDue(now - 6 * 24 * 60 * 60 * 1000, 'weekly', now)).toBe(false);
    expect(isUpdateCheckDue(now - 7 * 24 * 60 * 60 * 1000, 'weekly', now)).toBe(true);
  });

  it('falls back to the GitHub release API when latest.json is not published yet', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          tag_name: 'v0.1.24',
          html_url: 'https://github.com/WaveF/hajimi/releases/tag/v0.1.24',
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    await expect(checkForLatestUpdate('0.1.23')).resolves.toEqual({
      status: 'available',
      manifest: {
        version: '0.1.24',
        releaseUrl: 'https://github.com/WaveF/hajimi/releases/tag/v0.1.24',
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });
});
