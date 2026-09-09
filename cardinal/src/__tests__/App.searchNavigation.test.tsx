import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { forwardRef } from 'react';
import type { CSSProperties, ChangeEvent, FocusEventHandler, KeyboardEvent, Ref } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

const mocks = vi.hoisted(() => ({
  filesTabContentProps: vi.fn(),
  navigateSearchHistory: vi.fn(),
  selectSingleRow: vi.fn(),
  queueDirectorySearch: vi.fn(),
  openDirectoryDialog: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: mocks.openDirectoryDialog,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      language: 'en-US',
      changeLanguage: vi.fn().mockResolvedValue(undefined),
    },
  }),
}));

vi.mock('../components/SearchBar', () => ({
  SearchBar: ({
    inputRef,
    value,
    onChange,
    onKeyDown,
    onFocus,
    onBlur,
    onSelectDirectory,
    directorySelectionError,
  }: {
    inputRef: Ref<HTMLInputElement>;
    value: string;
    onChange: (event: ChangeEvent<HTMLInputElement>) => void;
    onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
    onFocus: FocusEventHandler<HTMLInputElement>;
    onBlur: FocusEventHandler<HTMLInputElement>;
    onSelectDirectory: () => void;
    directorySelectionError?: string | null;
  }) => (
    <>
      <input
        data-testid="search-input"
        ref={inputRef}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
      />
      <button data-testid="directory-picker" onClick={onSelectDirectory} />
      {directorySelectionError ? <div role="status">{directorySelectionError}</div> : null}
    </>
  ),
}));

vi.mock('../components/FileRow', () => ({
  FileRow: () => <div data-testid="file-row" />,
}));

vi.mock('../components/FilesTabContent', () => ({
  FilesTabContent: ({
    currentDirectoryQuery,
    currentQuery,
    renderRow,
  }: {
    currentDirectoryQuery: string;
    currentQuery: string;
    renderRow: (
      rowIndex: number,
      item: { path: string } | undefined,
      rowStyle: CSSProperties,
    ) => React.ReactNode;
  }) => {
    mocks.filesTabContentProps({ currentDirectoryQuery, currentQuery });
    return (
      <div data-testid="files-tab-content">
        {renderRow(0, { path: '/first-result' }, {} as CSSProperties)}
      </div>
    );
  },
}));

vi.mock('../components/PermissionOverlay', () => ({
  PermissionOverlay: () => null,
}));

vi.mock('../components/PreferencesOverlay', () => ({
  default: () => null,
}));

vi.mock('../components/StatusBar', () => ({
  default: () => null,
}));

vi.mock('../components/FSEventsPanel', () => ({
  default: forwardRef(function MockFSEventsPanel(_props, _ref) {
    return null;
  }),
}));

vi.mock('../hooks/useFileSearch', () => ({
  useFileSearch: () => ({
    state: {
      results: [101, 202],
      resultsVersion: 1,
      scannedFiles: 0,
      processedEvents: 0,
      rescanErrors: 0,
      currentQuery: 'needle',
      currentDirectoryQuery: 'Work/Docs',
      highlightTerms: [],
      showLoadingUI: false,
      initialFetchCompleted: true,
      durationMs: 0,
      resultCount: 2,
      searchError: null,
      lifecycleState: 'Ready',
    },
    searchParams: {
      query: 'needle',
      directoryQuery: 'Work/Docs',
      directoryScopeOpen: true,
      caseSensitive: false,
    },
    updateSearchParams: vi.fn(),
    queueSearch: vi.fn(),
    queueDirectorySearch: mocks.queueDirectorySearch,
    queueDirectoryScopeOpen: vi.fn(),
    handleStatusUpdate: vi.fn(),
    setLifecycleState: vi.fn(),
    requestRescan: vi.fn(),
  }),
}));

vi.mock('../hooks/useColumnResize', () => ({
  useColumnResize: () => ({
    colWidths: {
      filename: 200,
      path: 300,
      size: 100,
      modified: 120,
      created: 120,
    },
    onResizeStart: vi.fn(() => vi.fn()),
    autoFitColumns: vi.fn(),
  }),
}));

vi.mock('../hooks/useEventColumnWidths', () => ({
  useEventColumnWidths: () => ({
    eventColWidths: {
      time: 120,
      event: 180,
      name: 180,
      path: 260,
    },
    onEventResizeStart: vi.fn(),
    autoFitEventColumns: vi.fn(),
  }),
}));

vi.mock('../hooks/useRecentFSEvents', () => ({
  useRecentFSEvents: () => ({
    filteredEvents: [],
  }),
}));

vi.mock('../hooks/useRemoteSort', () => ({
  DEFAULT_SORTABLE_RESULT_THRESHOLD: 20000,
  useRemoteSort: () => ({
    sortState: null,
    displayedResults: [101, 202],
    displayedResultsVersion: 1,
    sortThreshold: 20000,
    setSortThreshold: vi.fn(),
    canSort: true,
    isSorting: false,
    sortDisabledTooltip: null,
    sortButtonsDisabled: false,
    handleSortToggle: vi.fn(),
  }),
}));

vi.mock('../hooks/useSelection', () => ({
  useSelection: () => ({
    selectedIndices: [],
    selectedIndicesRef: { current: [] },
    activeRowIndex: null,
    selectedPaths: [],
    handleRowSelect: vi.fn(),
    selectSingleRow: mocks.selectSingleRow,
    clearSelection: vi.fn(),
    moveSelection: vi.fn(),
  }),
}));

vi.mock('../hooks/useQuickLook', () => ({
  useQuickLook: () => ({
    toggleQuickLook: vi.fn(),
    updateQuickLook: vi.fn(),
    closeQuickLook: vi.fn(),
  }),
}));

vi.mock('../hooks/useSearchHistory', () => ({
  useSearchHistory: () => ({
    handleInputChange: vi.fn(),
    navigate: mocks.navigateSearchHistory,
    ensureTailValue: vi.fn(),
    resetCursorToTail: vi.fn(),
  }),
}));

vi.mock('../hooks/useFullDiskAccessPermission', () => ({
  useFullDiskAccessPermission: () => ({
    status: 'granted',
    isChecking: false,
    requestPermission: vi.fn(),
  }),
}));

vi.mock('../hooks/useAppPreferences', () => ({
  useAppPreferences: () => ({
    isPreferencesOpen: false,
    closePreferences: vi.fn(),
    trayIconEnabled: false,
    setTrayIconEnabled: vi.fn(),
    watchRoot: '/',
    defaultWatchRoot: '/',
    ignorePaths: ['/Volumes'],
    defaultIgnorePaths: ['/Volumes'],
    preferencesResetToken: 0,
    handleWatchConfigChange: vi.fn(),
    handleResetPreferences: vi.fn(),
  }),
}));

vi.mock('../hooks/useAppWindowListeners', () => ({
  useAppWindowListeners: () => ({ isWindowFocused: true }),
}));

vi.mock('../hooks/useAppHotkeys', () => ({
  useAppHotkeys: () => undefined,
}));

vi.mock('../hooks/useContextMenu', () => ({
  useContextMenu: () => ({
    showContextMenu: vi.fn(),
    showHeaderContextMenu: vi.fn(),
  }),
}));

vi.mock('../hooks/useStableEvent', () => ({
  useStableEvent: <T extends (...args: any[]) => any>(handler: T): T => handler,
}));

describe('App search result keyboard navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.navigateSearchHistory.mockReturnValue(null);
  });

  it('passes main query and folder scope separately to the files tab content', () => {
    render(<App />);

    expect(mocks.filesTabContentProps).toHaveBeenLastCalledWith({
      currentDirectoryQuery: 'Work/Docs',
      currentQuery: 'needle',
    });
  });

  it('selects the first result and blurs the search input when ArrowDown reaches the history tail', () => {
    render(<App />);

    const input = screen.getByTestId('search-input');
    act(() => {
      input.focus();
    });
    expect(document.activeElement).toBe(input);

    act(() => {
      fireEvent.keyDown(input, {
        key: 'ArrowDown',
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
      });
    });

    expect(mocks.navigateSearchHistory).toHaveBeenCalledWith('newer');
    expect(mocks.selectSingleRow).toHaveBeenCalledWith(0);
    expect(document.activeElement).not.toBe(input);
  });

  it('passes a selected directory to the existing directory search queue', async () => {
    mocks.openDirectoryDialog.mockResolvedValueOnce('/Users/wavef/Documents/Projects');
    render(<App />);

    fireEvent.click(screen.getByTestId('directory-picker'));

    await waitFor(() => {
      expect(mocks.openDirectoryDialog).toHaveBeenCalledWith({ directory: true, multiple: false });
      expect(mocks.queueDirectorySearch).toHaveBeenCalledWith('/Users/wavef/Documents/Projects', {
        immediate: true,
      });
    });
  });

  it('does not change the directory search when the native picker is cancelled', async () => {
    mocks.openDirectoryDialog.mockResolvedValueOnce(null);
    render(<App />);

    fireEvent.click(screen.getByTestId('directory-picker'));

    await waitFor(() => expect(mocks.openDirectoryDialog).toHaveBeenCalledTimes(1));
    expect(mocks.queueDirectorySearch).not.toHaveBeenCalled();
  });

  it('shows a non-blocking error when the native picker fails', async () => {
    mocks.openDirectoryDialog.mockRejectedValueOnce(new Error('permission denied'));
    render(<App />);

    fireEvent.click(screen.getByTestId('directory-picker'));

    expect(await screen.findByRole('status')).toHaveTextContent('search.errors.directorySelection');
    expect(mocks.queueDirectorySearch).not.toHaveBeenCalled();
  });
});
