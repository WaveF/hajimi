import React, { useEffect, useRef } from 'react';
import type { ChangeEvent, FocusEventHandler } from 'react';

const MACOS_FOLDER_ICON =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAERlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAIKADAAQAAAABAAAAIAAAAACshmLzAAADGUlEQVRYCe1XsW4TQRCdPZ9tEsuxiEmTABIFSijpKKClooiEhNKAlJJIFBRUfAEVEgW/QEoKkCiQKEAUNDRE0EBQFKBACbIT49z57pb39rx3Z0exneSiUGSsOe/tzs68ndmZ3RM5oWP2gMrYd9Eud7mQ6e9vRujwutzpH9zvuwVA47W7r78/Gps4fdsRXRqgKPK9ztsn16YWIPMH7IP1APmBQxZA7c7L1celanWR0lpraLRD6XzFXqWkgDGtvW/NlU/3l5euf4BEmEoNbFHOei+gpLVy7uarX18dkaJWWiKshyD6icYddLsQdAuOFCDr4KfYOYwgEumo7W01l5/Nzz2AeAMc0PWk8a22V6SBvVYfixExjAJ2AQ/+GwBDIkC9Xe+NSbGyeGP5i/tiYe4edDYsgMJ2G6FUWNoIZFesdKx46BSoJVACJpDIcW9hzkNwAkC1PWxo2tejgRhqtE+AoC1gtJht4xSxHpC/vi9n6xNyabouk9US4mu3R5+mA76G2FObW758/rkh65vb1GJSPQFQr47LlYvTRn0A4c6o+3pEQIxurVI2Nt6srHOWWWECYHbmjHgB0g87e9hGHNFmj5gK4xRmGGZnJuV9dzQBMHaqJF4YLxuiGI6B9Gg54AuzgKSERVSEtiwlALBsAUhTaLSOBa3QYf9tTbFpntWXAAgiFCYESkX5br6sMeNVhFgyC0wARPS+sT1CVevVuv+3jIkEQIj6q1S+rt8LmQ0Jx3sAAMFec/Ltz5wzPQCO1QORSZGjKcO73ZeG+j/yQBggCwfdxHav46A92qRcPDvxgOnToSlER3UiosjEF500AmkWBPSAOd/hBQdFIe9jmSlOtXhoXrm6ZD0Qtdo7UnZdhAGCuG4pVqu89iRU8ZCTEB6Aq73AXAfRm9aBnUajuVafqJw3wFiSc64Jpvh0S3Cj2VqDnR3aspWnjvaFy0/fPa+UyjPFYl5Lp4mUOp1IWr734+PS1Xn0roI3LACejwQxBa6BmQ4cs+NoHooYdDJPHN6Gf4M3wH7WAEHYL6M8jUOtIQvCfhfwg+aE5B+lBx09YnlGKQAAAABJRU5ErkJggg==';

type SearchBarProps = {
  inputRef: React.RefObject<HTMLInputElement>;
  placeholder: string;
  ariaLabel: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  directoryScopeEnabled: boolean;
  directoryScopeOpen: boolean;
  directoryScopeLabel: string;
  directoryValue: string;
  directorySelectLabel: string;
  directoryCollapseLabel: string;
  directorySelectionError?: string | null;
  onToggleDirectoryScope: () => void;
  onSelectDirectory: () => void;
  caseSensitive: boolean;
  onToggleCaseSensitive: (event: ChangeEvent<HTMLInputElement>) => void;
  caseSensitiveLabel: string;
  onFocus: FocusEventHandler<HTMLElement>;
  onBlur: FocusEventHandler<HTMLElement>;
};

export function SearchBar({
  inputRef,
  placeholder,
  ariaLabel,
  value,
  onChange,
  onKeyDown,
  directoryScopeEnabled,
  directoryScopeOpen,
  directoryScopeLabel,
  directoryValue,
  directorySelectLabel,
  directoryCollapseLabel,
  directorySelectionError,
  onToggleDirectoryScope,
  onSelectDirectory,
  caseSensitive,
  onToggleCaseSensitive,
  caseSensitiveLabel,
  onFocus,
  onBlur,
}: SearchBarProps): React.JSX.Element {
  const directorySelectRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (directoryScopeOpen) {
      directorySelectRef.current?.focus();
    }
  }, [directoryScopeOpen]);

  return (
    <div className="search-container">
      <div className="search-bar">
        {directoryScopeEnabled ? (
          <div className={`directory-scope-segment${directoryScopeOpen ? ' is-open' : ''}`}>
            {directoryScopeOpen ? null : (
              <button
                type="button"
                className="directory-scope-toggle"
                aria-label={directoryScopeLabel}
                aria-pressed="false"
                title={directoryScopeLabel}
                onClick={onToggleDirectoryScope}
              >
                <svg className="directory-scope-chevron" viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M4 0L12 8l-8 8" />
                </svg>
              </button>
            )}
            <div
              className={`directory-scope-field${directoryScopeOpen ? ' is-open' : ''}`}
              aria-hidden={!directoryScopeOpen}
            >
              <button
                ref={directorySelectRef}
                type="button"
                className="directory-scope-field-toggle"
                aria-label={directorySelectLabel}
                title={directoryValue || directorySelectLabel}
                onClick={onSelectDirectory}
                onFocus={onFocus}
                onBlur={onBlur}
              >
                <img src={MACOS_FOLDER_ICON} alt="" aria-hidden="true" />
                <span className="directory-scope-value">
                  {directoryValue || directoryScopeLabel}
                </span>
              </button>
              <button
                type="button"
                className="directory-scope-collapse"
                aria-label={directoryCollapseLabel}
                title={directoryCollapseLabel}
                onClick={onToggleDirectoryScope}
                onFocus={onFocus}
                onBlur={onBlur}
              >
                <svg
                  className="directory-scope-collapse-icon"
                  viewBox="0 0 16 16"
                  aria-hidden="true"
                >
                  <path d="m12 4-4 4 4 4" />
                </svg>
              </button>
            </div>
            {directorySelectionError ? (
              <span className="directory-scope-error" role="status">
                {directorySelectionError}
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="search-segment query-search-segment">
          <input
            id="search-input"
            ref={inputRef}
            value={value}
            onChange={onChange}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            aria-label={ariaLabel}
            spellCheck={false}
            autoCorrect="off"
            autoComplete="off"
            autoCapitalize="off"
            onFocus={onFocus}
            onBlur={onBlur}
          />
          <label className="search-option" title={caseSensitiveLabel}>
            <input
              type="checkbox"
              checked={caseSensitive}
              onChange={onToggleCaseSensitive}
              aria-label={caseSensitiveLabel}
            />
            <span className="search-option__display" aria-hidden="true">
              Aa
            </span>
            <span className="sr-only">{caseSensitiveLabel}</span>
          </label>
        </div>
      </div>
    </div>
  );
}
