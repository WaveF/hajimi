import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { getWatchRootValidation, isIgnorePatternValid, isPathInputValid } from '../utils/watchRoot';
import { formatShortcutForDisplay, shortcutFromKeyboardEvent } from '../utils/globalShortcuts';
import ThemeSwitcher from './ThemeSwitcher';
import LanguageSwitcher from './LanguageSwitcher';

type PreferencesOverlayProps = {
  open: boolean;
  onClose: () => void;
  sortThreshold: number;
  defaultSortThreshold: number;
  onSortThresholdChange: (value: number) => void;
  trayIconEnabled: boolean;
  onTrayIconEnabledChange: (enabled: boolean) => void;
  hideEmptyResults: boolean;
  onHideEmptyResultsChange: (enabled: boolean) => void;
  refreshEventsOnlyWhenActive: boolean;
  onRefreshEventsOnlyWhenActiveChange: (enabled: boolean) => void;
  globalShortcut: string;
  defaultGlobalShortcut: string;
  onGlobalShortcutChange: (shortcut: string) => Promise<void> | void;
  onQuit: () => void;
  watchRoot: string;
  defaultWatchRoot: string;
  onWatchConfigChange: (next: {
    watchRoot: string;
    ignorePaths: string[];
    includePaths: string[];
  }) => void;
  ignorePaths: string[];
  defaultIgnorePaths: string[];
  includePaths: string[];
  defaultIncludePaths: string[];
  onReset: () => void;
  themeResetToken: number;
};

type PreferencesSectionId = 'general' | 'search' | 'indexing' | 'mcp';

type McpConnectionInfo = {
  available: boolean;
  discoveryPath: string;
  executablePath: string;
};

const PREFERENCES_NAV_ITEMS: Array<{
  id: PreferencesSectionId;
  labelKey: string;
}> = [
  { id: 'general', labelKey: 'preferences.nav.general' },
  { id: 'search', labelKey: 'preferences.nav.search' },
  { id: 'indexing', labelKey: 'preferences.nav.indexing' },
  { id: 'mcp', labelKey: 'preferences.nav.mcp' },
];

function PreferencesNavIcon({
  section,
  className = 'preferences-nav__icon',
}: {
  section: PreferencesSectionId;
  className?: string;
}): React.JSX.Element {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {section === 'general' ? (
        <>
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </>
      ) : section === 'search' ? (
        <>
          <circle cx="10.8" cy="10.8" r="6.8" />
          <line x1="16" y1="16" x2="21" y2="21" />
        </>
      ) : section === 'indexing' ? (
        <>
          <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5z" />
          <path d="M8 8h8M8 12h8M8 16h5" />
        </>
      ) : (
        <>
          <path d="M12 3v4" />
          <path d="M12 17v4" />
          <path d="M3 12h4" />
          <path d="M17 12h4" />
          <circle cx="12" cy="12" r="4" />
        </>
      )}
    </svg>
  );
}

export function PreferencesOverlay({
  open,
  onClose,
  sortThreshold,
  defaultSortThreshold,
  onSortThresholdChange,
  trayIconEnabled,
  onTrayIconEnabledChange,
  hideEmptyResults,
  onHideEmptyResultsChange,
  refreshEventsOnlyWhenActive,
  onRefreshEventsOnlyWhenActiveChange,
  globalShortcut,
  defaultGlobalShortcut,
  onGlobalShortcutChange,
  onQuit,
  watchRoot,
  defaultWatchRoot,
  onWatchConfigChange,
  ignorePaths,
  defaultIgnorePaths,
  includePaths,
  defaultIncludePaths,
  onReset,
  themeResetToken,
}: PreferencesOverlayProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const [thresholdInput, setThresholdInput] = useState<string>(() => sortThreshold.toString());
  const [watchRootInput, setWatchRootInput] = useState<string>(() => watchRoot);
  const [ignorePathsInput, setIgnorePathsInput] = useState<string>(() => ignorePaths.join('\n'));
  const [includePathsInput, setIncludePathsInput] = useState<string>(() => includePaths.join('\n'));
  const [globalShortcutInput, setGlobalShortcutInput] = useState<string>(() => globalShortcut);
  const [globalShortcutError, setGlobalShortcutError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<PreferencesSectionId>('general');
  const [mcpInfo, setMcpInfo] = useState<McpConnectionInfo | null>(null);
  const [mcpCopied, setMcpCopied] = useState(false);

  const mcpPrompt = useMemo(() => {
    const executablePath = mcpInfo?.executablePath || 'PATH_TO_HAJIMI_EXECUTABLE';
    const discoveryPath = mcpInfo?.discoveryPath || 'PATH_TO_HAJIMI_MCP_DISCOVERY_FILE';
    const command = JSON.stringify(executablePath);
    const discovery = JSON.stringify(discoveryPath);
    return `Use hajimi as a local MCP server for file search and file navigation.

MCP client configuration:
{
  "mcpServers": {
    "hajimi": {
      "command": ${command},
      "args": ["--mcp", "--discovery", ${discovery}]
    }
  }
}

Available tools:
- search_files: search indexed files and folders. Required: query. Optional: directoryQuery, caseSensitive, limit (maximum 500). The query supports hajimi keywords, filters, and wildcards.
- open_path: open a file or folder with the operating system default application.
- reveal_in_finder: reveal a file or folder in Finder.

Use search_files before opening a path when the exact path is unknown. Confirm ambiguous results with the user. Only use the listed read-oriented tools; do not invent write or delete capabilities. The discovery path contains a local authentication token and must not be shared.`;
  }, [mcpInfo]);

  useEffect(() => {
    if (!open || activeSection !== 'mcp') {
      return;
    }
    let cancelled = false;
    setMcpCopied(false);
    void invoke<McpConnectionInfo>('get_mcp_connection_info')
      .then((info) => {
        if (!cancelled) {
          setMcpInfo(info);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMcpInfo(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeSection, open]);

  const copyMcpPrompt = async (): Promise<void> => {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard API is unavailable');
      }
      await navigator.clipboard.writeText(mcpPrompt);
      setMcpCopied(true);
      window.setTimeout(() => setMcpCopied(false), 1800);
    } catch (error) {
      console.error('Failed to copy MCP prompt', error);
    }
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose();
        event.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setThresholdInput(sortThreshold.toString());
  }, [open, sortThreshold]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setWatchRootInput(watchRoot);
    setIgnorePathsInput(ignorePaths.join('\n'));
    setIncludePathsInput(includePaths.join('\n'));
    setGlobalShortcutInput(globalShortcut);
    setGlobalShortcutError(false);
  }, [open, watchRoot, ignorePaths, includePaths, globalShortcut]);

  const handleGlobalShortcutKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      setGlobalShortcutInput('');
      setGlobalShortcutError(false);
      return;
    }

    const shortcut = shortcutFromKeyboardEvent(event.nativeEvent);
    event.preventDefault();
    if (shortcut) {
      setGlobalShortcutInput(shortcut);
      setGlobalShortcutError(false);
    }
  };

  const clearGlobalShortcut = (): void => {
    setGlobalShortcutInput('');
    setGlobalShortcutError(false);
  };

  const commitThreshold = useCallback(() => {
    const numericText = thresholdInput.replace(/[^\d]/g, '');
    if (!numericText) {
      setThresholdInput(sortThreshold.toString());
      return;
    }
    const parsed = Number.parseInt(numericText, 10);
    if (Number.isNaN(parsed)) {
      setThresholdInput(sortThreshold.toString());
      return;
    }
    const normalized = Math.max(1, Math.round(parsed));
    onSortThresholdChange(normalized);
    setThresholdInput(normalized.toString());
  }, [onSortThresholdChange, sortThreshold, thresholdInput]);

  const handleThresholdChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const value = event.target.value;
    if (/^\d*$/.test(value)) {
      setThresholdInput(value);
    }
  };

  const { errorKey: watchRootErrorKey } = getWatchRootValidation(watchRootInput);
  const watchRootErrorMessage = watchRootErrorKey ? t(watchRootErrorKey) : null;

  const parsedIgnorePaths = ignorePathsInput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const ignorePathsErrorMessage = (() => {
    const invalid = parsedIgnorePaths.find((line) => !isIgnorePatternValid(line));
    return invalid ? t('ignorePaths.errors.pattern') : null;
  })();

  const parsedIncludePaths = includePathsInput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const includePathsErrorMessage = (() => {
    const invalid = parsedIncludePaths.find((line) => !isPathInputValid(line));
    return invalid ? t('includePaths.errors.absolute') : null;
  })();

  const handleSave = async (): Promise<void> => {
    if (watchRootErrorMessage || ignorePathsErrorMessage || includePathsErrorMessage) {
      return;
    }

    const trimmedGlobalShortcut = globalShortcutInput.trim();
    if (trimmedGlobalShortcut !== globalShortcut) {
      setIsSaving(true);
      setGlobalShortcutError(false);
      try {
        await onGlobalShortcutChange(trimmedGlobalShortcut);
      } catch (error) {
        console.error('Failed to update global shortcut', error);
        setGlobalShortcutError(true);
        return;
      } finally {
        setIsSaving(false);
      }
    }

    commitThreshold();
    const trimmedWatchRoot = watchRootInput.trim();
    onWatchConfigChange({
      watchRoot: trimmedWatchRoot,
      ignorePaths: parsedIgnorePaths,
      includePaths: parsedIncludePaths,
    });
    setWatchRootInput(trimmedWatchRoot);
    setIgnorePathsInput(parsedIgnorePaths.join('\n'));
    setIncludePathsInput(parsedIncludePaths.join('\n'));
    onClose();
  };

  const handleReset = (): void => {
    setThresholdInput(defaultSortThreshold.toString());
    setWatchRootInput(defaultWatchRoot);
    setIgnorePathsInput(defaultIgnorePaths.join('\n'));
    setIncludePathsInput(defaultIncludePaths.join('\n'));
    setGlobalShortcutInput(defaultGlobalShortcut);
    setGlobalShortcutError(false);
    onReset();
  };

  const handleSectionNavigation = (section: PreferencesSectionId): void => {
    setActiveSection(section);
    const prefersReducedMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    document.getElementById(`preferences-section-${section}`)?.scrollIntoView?.({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'start',
    });
  };

  const handleSectionScroll = (event: React.UIEvent<HTMLDivElement>): void => {
    const container = event.currentTarget;
    const containerTop = container.getBoundingClientRect().top;
    let visibleSection: PreferencesSectionId = 'general';

    for (const item of PREFERENCES_NAV_ITEMS) {
      const sectionElement = document.getElementById(`preferences-section-${item.id}`);
      if (!sectionElement) continue;
      if (sectionElement.getBoundingClientRect().top - containerTop <= 48) {
        visibleSection = item.id;
      }
    }

    setActiveSection(visibleSection);
  };

  if (!open) {
    return null;
  }

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>): void => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="preferences-overlay"
      role="dialog"
      aria-modal="true"
      onClick={handleOverlayClick}
    >
      <div className="preferences-card">
        <div className="preferences-layout">
          <aside className="preferences-nav">
            <div className="preferences-nav__brand">
              <PreferencesNavIcon section="general" className="preferences-nav__brand-icon" />
              <span>设置</span>
            </div>
            <nav aria-label={t('preferences.title')}>
              {PREFERENCES_NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  className={`preferences-nav__item${activeSection === item.id ? ' is-active' : ''}`}
                  type="button"
                  onClick={() => handleSectionNavigation(item.id)}
                  aria-current={activeSection === item.id ? 'page' : undefined}
                >
                  <PreferencesNavIcon section={item.id} />
                  <span>{t(item.labelKey)}</span>
                </button>
              ))}
            </nav>
            <div className="preferences-nav__footer">
              <button className="preferences-quit" type="button" onClick={onQuit}>
                <svg
                  className="preferences-quit__icon"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M13 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
                  <path d="M3 12h10" />
                  <path d="m7 8 4 4-4 4" />
                  <path d="M13 4v16" />
                </svg>
                {t('tray.quit')}
              </button>
            </div>
          </aside>

          <main className="preferences-content">
            <header className="preferences-card__header">
              <div>
                <h1 className="preferences-card__title">{t('preferences.title')}</h1>
              </div>
              <button
                className="preferences-card__close"
                type="button"
                onClick={onClose}
                aria-label={t('preferences.close')}
              >
                <span aria-hidden="true">×</span>
              </button>
            </header>

            <div className="preferences-section" onScroll={handleSectionScroll}>
              <section id="preferences-section-general" className="preferences-group">
                <div className="preferences-group__header">
                  <h2 className="preferences-group__title">{t('preferences.nav.general')}</h2>
                </div>
                <div className="preferences-settings-card">
                  <div className="preferences-row">
                    <p className="preferences-label">{t('preferences.appearance')}</p>
                    <ThemeSwitcher className="preferences-control" resetToken={themeResetToken} />
                  </div>
                  <div className="preferences-row">
                    <p className="preferences-label">{t('preferences.language')}</p>
                    <LanguageSwitcher className="preferences-control" />
                  </div>
                  <div className="preferences-row">
                    <p className="preferences-label">{t('preferences.trayIcon.label')}</p>
                    <div className="preferences-control">
                      <label className="preferences-switch">
                        <input
                          className="preferences-switch__input"
                          type="checkbox"
                          checked={trayIconEnabled}
                          onChange={(event) => onTrayIconEnabledChange(event.target.checked)}
                          aria-label={t('preferences.trayIcon.label')}
                        />
                        <span className="preferences-switch__track" aria-hidden="true" />
                      </label>
                    </div>
                  </div>
                  <div className="preferences-row">
                    <div className="preferences-row__details">
                      <p className="preferences-label">{t('preferences.globalShortcut.label')}</p>
                    </div>
                    <div className="preferences-control preferences-shortcut-control">
                      <div className="preferences-shortcut-input-row">
                        <div className="preferences-shortcut-input-shell">
                          <input
                            className="preferences-field preferences-shortcut-input"
                            type="text"
                            value={formatShortcutForDisplay(globalShortcutInput)}
                            onKeyDown={handleGlobalShortcutKeyDown}
                            onChange={() => {}}
                            placeholder={t('preferences.globalShortcut.placeholder')}
                            aria-label={t('preferences.globalShortcut.label')}
                            readOnly
                            autoComplete="off"
                            spellCheck={false}
                          />
                          {globalShortcutInput ? (
                            <button
                              className="preferences-shortcut-clear"
                              type="button"
                              onClick={clearGlobalShortcut}
                              aria-label={t('preferences.globalShortcut.clear')}
                            >
                              <svg
                                className="preferences-shortcut-clear__icon"
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                aria-hidden="true"
                              >
                                <circle cx="12" cy="12" r="9" />
                                <path d="m9 9 6 6M15 9l-6 6" />
                              </svg>
                            </button>
                          ) : null}
                        </div>
                      </div>
                      {globalShortcutError ? (
                        <p
                          className="permission-status permission-status--error preferences-field-error"
                          role="status"
                          aria-live="polite"
                        >
                          {t('preferences.globalShortcut.errors.unavailable')}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </section>

              <section id="preferences-section-search" className="preferences-group">
                <div className="preferences-group__header">
                  <h2 className="preferences-group__title">{t('preferences.nav.search')}</h2>
                </div>
                <div className="preferences-settings-card">
                  <div className="preferences-row">
                    <p className="preferences-label">{t('preferences.hideEmptyResults.label')}</p>
                    <div className="preferences-control">
                      <label className="preferences-switch">
                        <input
                          className="preferences-switch__input"
                          type="checkbox"
                          checked={hideEmptyResults}
                          onChange={(event) => onHideEmptyResultsChange(event.target.checked)}
                          aria-label={t('preferences.hideEmptyResults.label')}
                        />
                        <span className="preferences-switch__track" aria-hidden="true" />
                      </label>
                    </div>
                  </div>
                  <div className="preferences-row">
                    <p className="preferences-label">
                      {t('preferences.refreshEventsOnlyWhenActive.label')}
                    </p>
                    <div className="preferences-control">
                      <label className="preferences-switch">
                        <input
                          className="preferences-switch__input"
                          type="checkbox"
                          checked={refreshEventsOnlyWhenActive}
                          onChange={(event) =>
                            onRefreshEventsOnlyWhenActiveChange(event.target.checked)
                          }
                          aria-label={t('preferences.refreshEventsOnlyWhenActive.label')}
                        />
                        <span className="preferences-switch__track" aria-hidden="true" />
                      </label>
                    </div>
                  </div>
                  <div className="preferences-row">
                    <div className="preferences-row__details">
                      <p className="preferences-label">{t('preferences.sortingLimit.label')}</p>
                    </div>
                    <div className="preferences-control">
                      <input
                        className="preferences-field preferences-number-input"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={thresholdInput}
                        onChange={handleThresholdChange}
                        aria-label={t('preferences.sortingLimit.label')}
                      />
                    </div>
                  </div>
                </div>
              </section>

              <section id="preferences-section-indexing" className="preferences-group">
                <div className="preferences-group__header">
                  <h2 className="preferences-group__title">{t('preferences.nav.indexing')}</h2>
                </div>
                <div className="preferences-settings-card">
                  <div className="preferences-row">
                    <div className="preferences-row__details">
                      <p className="preferences-label" title={t('watchRoot.help')}>
                        {t('watchRoot.label')}
                      </p>
                    </div>
                    <div className="preferences-control">
                      <input
                        className="preferences-field preferences-number-input preferences-watch-root-input"
                        type="text"
                        value={watchRootInput}
                        onChange={(event) => setWatchRootInput(event.target.value)}
                        aria-label={t('watchRoot.label')}
                        autoComplete="off"
                        spellCheck={false}
                      />
                      {watchRootErrorMessage ? (
                        <p
                          className="permission-status permission-status--error preferences-field-error"
                          role="status"
                          aria-live="polite"
                        >
                          {watchRootErrorMessage}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="preferences-row">
                    <div className="preferences-row__details">
                      <p className="preferences-label" title={t('ignorePaths.help')}>
                        {t('ignorePaths.label')}
                      </p>
                    </div>
                    <div className="preferences-control">
                      <textarea
                        className="preferences-field preferences-textarea"
                        value={ignorePathsInput}
                        onChange={(event) => setIgnorePathsInput(event.target.value)}
                        aria-label={t('ignorePaths.label')}
                        autoComplete="off"
                        spellCheck={false}
                      />
                      {ignorePathsErrorMessage ? (
                        <p
                          className="permission-status permission-status--error preferences-field-error"
                          role="status"
                          aria-live="polite"
                        >
                          {ignorePathsErrorMessage}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="preferences-row">
                    <div className="preferences-row__details">
                      <p className="preferences-label" title={t('includePaths.help')}>
                        {t('includePaths.label')}
                      </p>
                    </div>
                    <div className="preferences-control">
                      <textarea
                        className="preferences-field preferences-textarea"
                        value={includePathsInput}
                        onChange={(event) => setIncludePathsInput(event.target.value)}
                        aria-label={t('includePaths.label')}
                        autoComplete="off"
                        spellCheck={false}
                      />
                      {includePathsErrorMessage ? (
                        <p
                          className="permission-status permission-status--error preferences-field-error"
                          role="status"
                          aria-live="polite"
                        >
                          {includePathsErrorMessage}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </section>

              <section id="preferences-section-mcp" className="preferences-group preferences-mcp">
                <div className="preferences-group__header">
                  <h2 className="preferences-group__title">{t('preferences.nav.mcp')}</h2>
                </div>
                <div className="preferences-mcp__intro">{t('preferences.mcp.description')}</div>
                <div className="preferences-settings-card">
                  <div className="preferences-mcp__status-row">
                    <span className="preferences-label">{t('preferences.mcp.status.label')}</span>
                    <span
                      className={`preferences-mcp__status${mcpInfo?.available ? ' is-ready' : ''}`}
                      role="status"
                    >
                      <span className="preferences-mcp__status-dot" aria-hidden="true" />
                      {mcpInfo?.available
                        ? t('preferences.mcp.status.ready')
                        : t('preferences.mcp.status.unavailable')}
                    </span>
                  </div>
                  <div className="preferences-mcp__prompt-header">
                    <label className="preferences-label" htmlFor="preferences-mcp-prompt">
                      {t('preferences.mcp.promptLabel')}
                    </label>
                    <button
                      className="preferences-mcp__copy"
                      type="button"
                      onClick={() => void copyMcpPrompt()}
                      disabled={!mcpInfo?.available}
                    >
                      {mcpCopied ? t('preferences.mcp.copied') : t('preferences.mcp.copy')}
                    </button>
                  </div>
                  <div className="preferences-row">
                    <textarea
                      id="preferences-mcp-prompt"
                      className="preferences-field preferences-textarea preferences-mcp__prompt"
                      value={mcpPrompt}
                      readOnly
                      rows={16}
                      aria-label={t('preferences.mcp.promptLabel')}
                    />
                  </div>
                </div>
              </section>
            </div>
            <footer className="preferences-card__footer">
              <button className="preferences-reset" type="button" onClick={handleReset}>
                {t('preferences.reset')}
              </button>
              <button
                className="preferences-save"
                type="button"
                onClick={handleSave}
                disabled={
                  isSaving ||
                  Boolean(
                    watchRootErrorMessage || ignorePathsErrorMessage || includePathsErrorMessage,
                  )
                }
              >
                {t('preferences.save')}
              </button>
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
}

export default PreferencesOverlay;
