import { useCallback, useEffect, useRef, useState } from 'react';
import {
  checkFullDiskAccessPermission,
  requestFullDiskAccessPermission as requestNativeFullDiskAccessPermission,
} from 'tauri-plugin-macos-permissions-api';

export type FullDiskAccessStatus = 'granted' | 'denied';

type UseFullDiskAccessPermissionResult = {
  status: FullDiskAccessStatus;
  isChecking: boolean;
  requestPermission: () => Promise<void>;
};

// This is intentionally limited to Vite dev builds so UI work can be done without
// granting macOS Full Disk Access. Release builds always perform the real check.
const skipPermissionCheck =
  import.meta.env.DEV && import.meta.env.VITE_HAJIMI_SKIP_FULL_DISK_ACCESS === 'true';

// Centralise macOS Full Disk Access state so App.tsx stays focused on UI concerns.
export function useFullDiskAccessPermission(): UseFullDiskAccessPermissionResult {
  const [status, setStatus] = useState<FullDiskAccessStatus>('granted');
  const [isChecking, setIsChecking] = useState(true);
  const hasLoggedPermissionStatusRef = useRef(false);

  const refreshStatus = useCallback(async () => {
    if (skipPermissionCheck) {
      setStatus('granted');
      setIsChecking(false);
      return;
    }

    setIsChecking(true);
    try {
      const authorized = await checkFullDiskAccessPermission();
      if (!hasLoggedPermissionStatusRef.current) {
        console.log('Full Disk Access granted:', authorized);
        hasLoggedPermissionStatusRef.current = true;
      }
      setStatus(authorized ? 'granted' : 'denied');
    } catch (error) {
      console.error('Failed to check full disk access permission', error);
      setStatus('denied');
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const requestPermission = useCallback(async () => {
    try {
      await requestNativeFullDiskAccessPermission();
    } finally {
      await refreshStatus();
    }
  }, [refreshStatus]);

  return {
    status,
    isChecking,
    requestPermission,
  };
}
