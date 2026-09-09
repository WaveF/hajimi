import { fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SearchBar } from '../SearchBar';

const renderSearchBar = (overrides: Partial<ComponentProps<typeof SearchBar>> = {}) => {
  const props: ComponentProps<typeof SearchBar> = {
    inputRef: createRef<HTMLInputElement>(),
    placeholder: 'Search',
    ariaLabel: 'Search input',
    value: '',
    onChange: vi.fn(),
    onKeyDown: vi.fn(),
    directoryScopeEnabled: true,
    directoryScopeOpen: true,
    directoryScopeLabel: 'Folder scope',
    directoryValue: '',
    directorySelectLabel: 'Choose folder scope',
    directoryCollapseLabel: 'Collapse folder scope',
    onToggleDirectoryScope: vi.fn(),
    onSelectDirectory: vi.fn(),
    caseSensitive: false,
    onToggleCaseSensitive: vi.fn(),
    caseSensitiveLabel: 'Case sensitive',
    onFocus: vi.fn(),
    onBlur: vi.fn(),
    ...overrides,
  };

  render(<SearchBar {...props} />);
  return props;
};

describe('SearchBar', () => {
  it('keeps the case sensitivity toggle inside the query field', () => {
    const onToggleCaseSensitive = vi.fn();

    renderSearchBar({ onToggleCaseSensitive });

    const toggle = screen.getByRole('checkbox', { name: 'Case sensitive' });
    const display = screen.getByText('Aa');

    expect(toggle.closest('.query-search-segment')).not.toBeNull();
    expect(document.querySelector('.search-options')).toBeNull();

    fireEvent.click(display);

    expect(onToggleCaseSensitive).toHaveBeenCalledTimes(1);
  });

  it('does not mark the folder scope toggle as pressed while folded with a saved value', () => {
    const onToggleDirectoryScope = vi.fn();
    renderSearchBar({
      directoryScopeOpen: false,
      directoryValue: 'Work/Docs',
      onToggleDirectoryScope,
    });

    const toggle = screen.getByRole('button', { name: 'Folder scope' });
    fireEvent.click(toggle);
    expect(onToggleDirectoryScope).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('separator')).toBeNull();
  });

  it('uses a separate folder button and collapse button while opened', () => {
    const onToggleDirectoryScope = vi.fn();
    const onSelectDirectory = vi.fn();
    renderSearchBar({ onToggleDirectoryScope, onSelectDirectory });

    const selectButton = screen.getByRole('button', { name: 'Choose folder scope' });
    expect(selectButton).toHaveClass('directory-scope-field-toggle');
    fireEvent.click(selectButton);
    expect(onSelectDirectory).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Collapse folder scope' }));
    expect(onToggleDirectoryScope).toHaveBeenCalledTimes(1);
  });

  it('routes directory button focus state through the shared search focus handlers', () => {
    const onFocus = vi.fn();
    const onBlur = vi.fn();
    renderSearchBar({ onFocus, onBlur });
    const directoryButton = screen.getByRole('button', { name: 'Choose folder scope' });

    onFocus.mockClear();
    fireEvent.focus(directoryButton);
    expect(onFocus).toHaveBeenCalledTimes(1);

    fireEvent.blur(directoryButton);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('shows the selected directory path without allowing manual editing', () => {
    renderSearchBar({ directoryValue: '/Users/wavef/Documents/Projects' });

    const selectButton = screen.getByRole('button', { name: 'Choose folder scope' });
    expect(selectButton).toHaveAttribute('title', '/Users/wavef/Documents/Projects');
    expect(screen.getByText('/Users/wavef/Documents/Projects')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Folder scope' })).toBeNull();
  });

  it('does not render a directory resize separator', () => {
    renderSearchBar();

    expect(screen.queryByRole('separator')).toBeNull();
  });

  it('does not move from query to directory when the folder scope is folded', () => {
    const onKeyDown = vi.fn();
    renderSearchBar({
      directoryScopeOpen: false,
      value: 'report',
      directoryValue: 'Work/Docs',
      onKeyDown,
    });
    const queryInput = screen.getByPlaceholderText('Search') as HTMLInputElement;

    queryInput.focus();
    queryInput.setSelectionRange(0, 0);
    fireEvent.keyDown(queryInput, { key: 'ArrowLeft' });

    expect(document.activeElement).toBe(queryInput);
    expect(onKeyDown).toHaveBeenCalledTimes(1);
  });
});
