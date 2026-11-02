import { invoke } from '@tauri-apps/api/core';

export const openResultPath = (path: string | null | undefined): void => {
  if (!path) {
    return;
  }

  void invoke('open_path', { path });
};

export const openResultDirectory = (path: string | null | undefined): void => {
  if (!path) {
    return;
  }

  // Keep directory-column double-click behavior aligned with Cmd+R so the
  // user's preferred Finder replacement (for example, QSpace) can handle it.
  void invoke('open_in_finder', { path });
};
