import { invoke } from '@tauri-apps/api/core';
import { Menu, MenuItem, PredefinedMenuItem } from '@tauri-apps/api/menu';
import { resolveResource } from '@tauri-apps/api/path';
import { TrayIcon, type TrayIconOptions } from '@tauri-apps/api/tray';
import i18n from './i18n/config';
import { getStoredGlobalShortcut } from './utils/globalShortcuts';

const TRAY_ID = 'hajimi.tray';
const TRAY_ICON_RESOURCE = 'icons/tray-search.png';

let trayInitPromise: Promise<void> | null = null;
let trayIcon: TrayIcon | null = null;
let trayOpenItem: MenuItem | null = null;
let trayGlobalShortcut = getStoredGlobalShortcut();

export function initializeTray(): Promise<void> {
  if (!trayInitPromise) {
    trayInitPromise = createTray().catch((error) => {
      console.error('Failed to initialize hajimi tray', error);
      trayInitPromise = null;
    });
  }

  return trayInitPromise;
}

export async function setTrayEnabled(enabled: boolean): Promise<void> {
  await invoke('set_tray_activation_policy', { enabled }).catch((error) => {
    console.error('Failed to update activation policy', error);
  });

  if (enabled) {
    await initializeTray();
    return;
  }

  const pendingInit = trayInitPromise;
  trayInitPromise = null;

  await pendingInit?.catch(() => {});

  const current = trayIcon;
  trayIcon = null;
  trayOpenItem = null;

  await Promise.allSettled([current?.close(), TrayIcon.removeById(TRAY_ID)]);
}

export async function setTrayGlobalShortcut(shortcut: string): Promise<void> {
  trayGlobalShortcut = shortcut;
  if (!trayOpenItem) {
    return;
  }

  await trayOpenItem.setAccelerator(shortcut || null).catch((error) => {
    console.error('Failed to update tray shortcut', error);
  });
}

async function createTray(): Promise<void> {
  const openItem = await MenuItem.new({
    id: 'tray.open',
    text: i18n.t('tray.open'),
    accelerator: trayGlobalShortcut || undefined,
    action: () => {
      void activateMainWindow();
    },
  });
  const menu = await Menu.new({
    items: [
      openItem,
      await PredefinedMenuItem.new({ item: 'Separator' }),
      await PredefinedMenuItem.new({ item: 'Quit', text: i18n.t('tray.quit') }),
    ],
  });
  trayOpenItem = openItem;
  await setTrayGlobalShortcut(trayGlobalShortcut);
  const trayIconPath = await resolveResource(TRAY_ICON_RESOURCE);
  const options: TrayIconOptions = {
    id: TRAY_ID,
    tooltip: 'hajimi',
    icon: trayIconPath,
    iconAsTemplate: true,
    menu,
  };

  trayIcon = await TrayIcon.new(options);
}

async function activateMainWindow(): Promise<void> {
  await invoke('activate_main_window');
}
