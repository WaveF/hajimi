import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PreferencesOverlay } from '../PreferencesOverlay';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue({
    available: true,
    discoveryPath: '/tmp/hajimi/mcp/bridge.json',
    executablePath: '/Applications/hajimi.app/Contents/MacOS/hajimi',
  }),
}));

vi.mock('../ThemeSwitcher', () => ({
  __esModule: true,
  default: () => <div data-testid="theme-switcher" />,
}));

vi.mock('../LanguageSwitcher', () => ({
  __esModule: true,
  default: () => <div data-testid="language-switcher" />,
}));

const baseProps = {
  open: true,
  onClose: vi.fn(),
  sortThreshold: 200,
  defaultSortThreshold: 100,
  onSortThresholdChange: vi.fn(),
  trayIconEnabled: false,
  onTrayIconEnabledChange: vi.fn(),
  hideEmptyResults: true,
  onHideEmptyResultsChange: vi.fn(),
  refreshEventsOnlyWhenActive: true,
  onRefreshEventsOnlyWhenActiveChange: vi.fn(),
  globalShortcut: '',
  defaultGlobalShortcut: '',
  onGlobalShortcutChange: vi.fn(),
  onQuit: vi.fn(),
  watchRoot: '/old/root',
  defaultWatchRoot: '/default/root',
  ignorePaths: ['/ignore/a', '/ignore/b'],
  defaultIgnorePaths: ['/default/ignore'],
  includePaths: ['/include/a'],
  defaultIncludePaths: [] as string[],
  onReset: vi.fn(),
  themeResetToken: 0,
  onWatchConfigChange: vi.fn(),
};

describe('PreferencesOverlay', () => {
  it('quits the app from the lower-left action', () => {
    const onQuit = vi.fn();
    render(<PreferencesOverlay {...baseProps} onQuit={onQuit} />);

    fireEvent.click(screen.getByRole('button', { name: 'tray.quit' }));

    expect(onQuit).toHaveBeenCalledTimes(1);
  });

  it('navigates between preference sections from the sidebar', () => {
    render(<PreferencesOverlay {...baseProps} />);

    const searchNavigation = screen.getByRole('button', { name: 'preferences.nav.search' });
    expect(searchNavigation).not.toHaveClass('is-active');

    fireEvent.click(searchNavigation);

    expect(searchNavigation).toHaveClass('is-active');
    expect(searchNavigation).toHaveAttribute('aria-current', 'page');
  });

  it('shows the MCP connection prompt and copies it for an AI agent', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    render(<PreferencesOverlay {...baseProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'preferences.nav.mcp' }));

    const prompt = await screen.findByLabelText('preferences.mcp.promptLabel');
    expect(prompt).toHaveAttribute('readonly');
    expect((prompt as HTMLTextAreaElement).value).toContain('search_files');

    const copyButton = screen.getByRole('button', { name: 'preferences.mcp.copy' });
    expect(copyButton).toBeEnabled();
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        expect.stringContaining('/tmp/hajimi/mcp/bridge.json'),
      );
    });
  });

  it('renders and updates search display switches', () => {
    const onHideEmptyResultsChange = vi.fn();
    const onRefreshEventsOnlyWhenActiveChange = vi.fn();
    render(
      <PreferencesOverlay
        {...baseProps}
        onHideEmptyResultsChange={onHideEmptyResultsChange}
        onRefreshEventsOnlyWhenActiveChange={onRefreshEventsOnlyWhenActiveChange}
      />,
    );

    const hideEmptyResults = screen.getByLabelText('preferences.hideEmptyResults.label');
    const refreshEventsOnlyWhenActive = screen.getByLabelText(
      'preferences.refreshEventsOnlyWhenActive.label',
    );
    expect(hideEmptyResults).toBeChecked();
    expect(refreshEventsOnlyWhenActive).toBeChecked();

    fireEvent.click(hideEmptyResults);
    fireEvent.click(refreshEventsOnlyWhenActive);

    expect(onHideEmptyResultsChange).toHaveBeenCalledWith(false);
    expect(onRefreshEventsOnlyWhenActiveChange).toHaveBeenCalledWith(false);
  });

  it('saves watch root updates via onWatchConfigChange', () => {
    const onWatchConfigChange = vi.fn();
    render(<PreferencesOverlay {...baseProps} onWatchConfigChange={onWatchConfigChange} />);

    const watchRootInput = screen.getByLabelText('watchRoot.label');
    fireEvent.change(watchRootInput, { target: { value: '/new/root' } });

    fireEvent.click(screen.getByText('preferences.save'));

    expect(onWatchConfigChange).toHaveBeenCalledWith({
      watchRoot: '/new/root',
      ignorePaths: baseProps.ignorePaths,
      includePaths: baseProps.includePaths,
    });
  });

  it('saves ignore path updates via onWatchConfigChange', () => {
    const onWatchConfigChange = vi.fn();
    render(<PreferencesOverlay {...baseProps} onWatchConfigChange={onWatchConfigChange} />);

    const ignorePathsInput = screen.getByLabelText('ignorePaths.label');
    fireEvent.change(ignorePathsInput, { target: { value: '/tmp/one\n/tmp/two' } });

    fireEvent.click(screen.getByText('preferences.save'));

    expect(onWatchConfigChange).toHaveBeenCalledWith({
      watchRoot: baseProps.watchRoot,
      ignorePaths: ['/tmp/one', '/tmp/two'],
      includePaths: baseProps.includePaths,
    });
  });

  it('accepts relative gitignore-style ignore rules', () => {
    const onWatchConfigChange = vi.fn();
    render(<PreferencesOverlay {...baseProps} onWatchConfigChange={onWatchConfigChange} />);

    const ignorePathsInput = screen.getByLabelText('ignorePaths.label');
    fireEvent.change(ignorePathsInput, {
      target: { value: 'node_modules/\n**/.git/\npackages/*/dist/' },
    });

    const saveButton = screen.getByText('preferences.save') as HTMLButtonElement;
    expect(saveButton.disabled).toBe(false);
    fireEvent.click(saveButton);

    expect(onWatchConfigChange).toHaveBeenCalledWith({
      watchRoot: baseProps.watchRoot,
      ignorePaths: ['node_modules/', '**/.git/', 'packages/*/dist/'],
      includePaths: baseProps.includePaths,
    });
  });

  it('blocks unsupported negated ignore rules', () => {
    const onWatchConfigChange = vi.fn();
    render(<PreferencesOverlay {...baseProps} onWatchConfigChange={onWatchConfigChange} />);

    const ignorePathsInput = screen.getByLabelText('ignorePaths.label');
    fireEvent.change(ignorePathsInput, { target: { value: '!keep/' } });

    const saveButton = screen.getByText('preferences.save') as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
    fireEvent.click(saveButton);
    expect(onWatchConfigChange).not.toHaveBeenCalled();
  });

  it('records and saves a global shortcut', async () => {
    const onGlobalShortcutChange = vi.fn().mockResolvedValue(undefined);
    render(<PreferencesOverlay {...baseProps} onGlobalShortcutChange={onGlobalShortcutChange} />);

    const shortcutInput = screen.getByLabelText('preferences.globalShortcut.label');
    fireEvent.keyDown(shortcutInput, {
      key: 'k',
      code: 'KeyK',
      metaKey: true,
      shiftKey: true,
    });

    expect(shortcutInput).toHaveValue('Ctrl+Shift+K');
    fireEvent.click(screen.getByText('preferences.save'));

    await waitFor(() => {
      expect(onGlobalShortcutChange).toHaveBeenCalledWith('CommandOrControl+Shift+K');
    });
  });

  it('clears a configured global shortcut', async () => {
    const onGlobalShortcutChange = vi.fn().mockResolvedValue(undefined);
    render(
      <PreferencesOverlay
        {...baseProps}
        globalShortcut="CommandOrControl+Shift+K"
        onGlobalShortcutChange={onGlobalShortcutChange}
      />,
    );

    fireEvent.click(screen.getByLabelText('preferences.globalShortcut.clear'));
    fireEvent.click(screen.getByText('preferences.save'));

    await waitFor(() => {
      expect(onGlobalShortcutChange).toHaveBeenCalledWith('');
    });
  });

  it('clears the shortcut with Escape without closing preferences', () => {
    const onClose = vi.fn();
    render(
      <PreferencesOverlay
        {...baseProps}
        globalShortcut="CommandOrControl+Shift+K"
        onClose={onClose}
      />,
    );

    const shortcutInput = screen.getByLabelText('preferences.globalShortcut.label');
    fireEvent.keyDown(shortcutInput, { key: 'Escape', code: 'Escape' });

    expect(shortcutInput).toHaveValue('');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps the preferences open when shortcut registration fails', async () => {
    const onGlobalShortcutChange = vi.fn().mockRejectedValue(new Error('shortcut is busy'));
    const onClose = vi.fn();
    render(
      <PreferencesOverlay
        {...baseProps}
        onClose={onClose}
        onGlobalShortcutChange={onGlobalShortcutChange}
      />,
    );

    fireEvent.keyDown(screen.getByLabelText('preferences.globalShortcut.label'), {
      key: 'k',
      code: 'KeyK',
      ctrlKey: true,
    });
    fireEvent.click(screen.getByText('preferences.save'));

    await waitFor(() => {
      expect(screen.getByText('preferences.globalShortcut.errors.unavailable')).toBeInTheDocument();
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('saves include path updates via onWatchConfigChange', () => {
    const onWatchConfigChange = vi.fn();
    render(<PreferencesOverlay {...baseProps} onWatchConfigChange={onWatchConfigChange} />);

    const includePathsInput = screen.getByLabelText('includePaths.label');
    fireEvent.change(includePathsInput, {
      target: { value: '/Volumes/media\n/Volumes/work' },
    });

    fireEvent.click(screen.getByText('preferences.save'));

    expect(onWatchConfigChange).toHaveBeenCalledWith({
      watchRoot: baseProps.watchRoot,
      ignorePaths: baseProps.ignorePaths,
      includePaths: ['/Volumes/media', '/Volumes/work'],
    });
  });

  it('blocks save when an include path is not absolute', () => {
    const onWatchConfigChange = vi.fn();
    render(<PreferencesOverlay {...baseProps} onWatchConfigChange={onWatchConfigChange} />);

    const includePathsInput = screen.getByLabelText('includePaths.label');
    fireEvent.change(includePathsInput, { target: { value: 'relative/path' } });

    const saveButton = screen.getByText('preferences.save') as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
    fireEvent.click(saveButton);
    expect(onWatchConfigChange).not.toHaveBeenCalled();
  });

  it('resets inputs to defaults before invoking onReset', () => {
    const onReset = vi.fn();
    const onWatchConfigChange = vi.fn();
    const onSortThresholdChange = vi.fn();
    render(
      <PreferencesOverlay
        {...baseProps}
        onReset={onReset}
        onWatchConfigChange={onWatchConfigChange}
        onSortThresholdChange={onSortThresholdChange}
      />,
    );

    fireEvent.click(screen.getByText('preferences.reset'));

    expect(screen.getByLabelText('preferences.sortingLimit.label')).toHaveValue(
      String(baseProps.defaultSortThreshold),
    );
    expect(screen.getByLabelText('watchRoot.label')).toHaveValue(baseProps.defaultWatchRoot);
    expect(screen.getByLabelText('ignorePaths.label')).toHaveValue(
      baseProps.defaultIgnorePaths.join('\n'),
    );
    expect(screen.getByLabelText('includePaths.label')).toHaveValue(
      baseProps.defaultIncludePaths.join('\n'),
    );
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onSortThresholdChange).not.toHaveBeenCalled();
    expect(onWatchConfigChange).not.toHaveBeenCalled();
  });

  it('applies staged reset values when saved', () => {
    const onWatchConfigChange = vi.fn();
    const onSortThresholdChange = vi.fn();
    render(
      <PreferencesOverlay
        {...baseProps}
        onWatchConfigChange={onWatchConfigChange}
        onSortThresholdChange={onSortThresholdChange}
      />,
    );

    fireEvent.click(screen.getByText('preferences.reset'));
    fireEvent.click(screen.getByText('preferences.save'));

    expect(onSortThresholdChange).toHaveBeenCalledWith(baseProps.defaultSortThreshold);
    expect(onWatchConfigChange).toHaveBeenCalledWith({
      watchRoot: baseProps.defaultWatchRoot,
      ignorePaths: baseProps.defaultIgnorePaths,
      includePaths: baseProps.defaultIncludePaths,
    });
  });

  it('closes preferences on Escape while editing a field', () => {
    const onClose = vi.fn();
    render(<PreferencesOverlay {...baseProps} onClose={onClose} />);

    const includePathsInput = screen.getByLabelText('includePaths.label');
    fireEvent.change(includePathsInput, { target: { value: '/tmp/changed' } });
    fireEvent.keyDown(includePathsInput, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
