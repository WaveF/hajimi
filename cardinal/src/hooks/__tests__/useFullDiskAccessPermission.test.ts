import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkFullDiskAccessPermission,
  requestFullDiskAccessPermission,
} from 'tauri-plugin-macos-permissions-api';
import { useFullDiskAccessPermission } from '../useFullDiskAccessPermission';

vi.mock('tauri-plugin-macos-permissions-api', () => ({
  checkFullDiskAccessPermission: vi.fn(),
  requestFullDiskAccessPermission: vi.fn(),
}));

describe('useFullDiskAccessPermission', () => {
  beforeEach(() => {
    vi.mocked(checkFullDiskAccessPermission).mockReset();
    vi.mocked(requestFullDiskAccessPermission).mockReset();
    vi.mocked(checkFullDiskAccessPermission).mockResolvedValue(false);
    vi.mocked(requestFullDiskAccessPermission).mockResolvedValue(undefined);
  });

  it('rechecks permission once when the app returns from System Settings', async () => {
    const { result } = renderHook(() => useFullDiskAccessPermission());

    await waitFor(() => expect(checkFullDiskAccessPermission).toHaveBeenCalledTimes(1));
    expect(result.current.status).toBe('denied');

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(checkFullDiskAccessPermission).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.requestPermission();
    });

    vi.mocked(checkFullDiskAccessPermission).mockResolvedValueOnce(true);
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => expect(result.current.status).toBe('granted'));
    expect(checkFullDiskAccessPermission).toHaveBeenCalledTimes(2);
  });

  it('rechecks after requesting permission', async () => {
    const { result } = renderHook(() => useFullDiskAccessPermission());

    await waitFor(() => expect(checkFullDiskAccessPermission).toHaveBeenCalledTimes(1));
    vi.mocked(checkFullDiskAccessPermission).mockResolvedValueOnce(true);

    await act(async () => {
      await result.current.requestPermission();
    });

    expect(result.current.status).toBe('denied');
    expect(requestFullDiskAccessPermission).toHaveBeenCalledTimes(1);

    vi.mocked(checkFullDiskAccessPermission).mockResolvedValueOnce(true);
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => expect(result.current.status).toBe('granted'));
  });
});
