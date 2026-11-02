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
  const isCheckingRef = useRef(false);
  const waitingForPermissionReturnRef = useRef(false);

  const refreshStatus = useCallback(async () => {
    if (isCheckingRef.current) {
      return;
    }

    isCheckingRef.current = true;

    if (skipPermissionCheck) {
      setStatus('granted');
      setIsChecking(false);
      isCheckingRef.current = false;
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
      isCheckingRef.current = false;
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    const refreshWhenAppReturns = () => {
      if (!waitingForPermissionReturnRef.current) {
        return;
      }
      waitingForPermissionReturnRef.current = false;
      void refreshStatus();
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        refreshWhenAppReturns();
      }
    };

    // System Settings is a separate app. Only re-check after this app explicitly
    // opened System Settings; focus and visibility can both fire on return.
    window.addEventListener('focus', refreshWhenAppReturns);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      window.removeEventListener('focus', refreshWhenAppReturns);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [refreshStatus]);

  const requestPermission = useCallback(async () => {
    waitingForPermissionReturnRef.current = true;
    try {
      await requestNativeFullDiskAccessPermission();
    } catch (error) {
      waitingForPermissionReturnRef.current = false;
      console.error('Failed to open Full Disk Access settings', error);
    }
  }, []);

  return {
    status,
    isChecking,
    requestPermission,
  };
}
