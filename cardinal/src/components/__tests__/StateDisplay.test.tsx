import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StateDisplay } from '../StateDisplay';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { directoryQuery?: string; query?: string }) => {
      switch (key) {
        case 'stateDisplay.loading':
          return 'Loading...';
        case 'stateDisplay.indexing':
          return 'Indexing, please wait...';
        case 'stateDisplay.error':
          return 'Something went wrong';
        case 'stateDisplay.emptyTitleWithDirectory':
          return `No results for "${options?.query}" in folder scope "${options?.directoryQuery}"`;
        case 'stateDisplay.emptyTitle':
          return options?.query ? `No results for "${options.query}"` : 'No recent results';
        case 'stateDisplay.emptyMessage':
          return 'Try adjusting your filters.';
        case 'stateDisplay.emptyQueryTitle':
          return 'Enter a keyword';
        case 'stateDisplay.emptyQueryMessage':
          return 'Supports fuzzy search by file or folder name';
        default:
          return key;
      }
    },
  }),
}));

describe('StateDisplay', () => {
  it('shows the indexing copy when the index is being rebuilt', () => {
    const { container } = render(<StateDisplay state="indexing" />);
    expect(screen.getByText('Indexing, please wait...')).toBeInTheDocument();
    expect(container.querySelector('.spinner')).not.toBeNull();
  });

  it('shows a spinner when in loading state', () => {
    const { container } = render(<StateDisplay state="loading" />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(container.querySelector('.spinner')).not.toBeNull();
  });

  it('renders the error message from props', () => {
    render(<StateDisplay state="error" message="Disk scan failed" />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Disk scan failed')).toBeInTheDocument();
  });

  it('shows the empty-state copy with the current query', () => {
    render(<StateDisplay state="empty" query="report" />);
    expect(screen.getByText('No results for "report"')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting your filters.')).toBeInTheDocument();
  });

  it('shows the empty-state copy with only the folder scope', () => {
    render(<StateDisplay state="empty" directoryQuery="Work/Docs" />);
    expect(screen.getByText('No results for "Work/Docs"')).toBeInTheDocument();
    expect(screen.queryByText(/folder scope/)).not.toBeInTheDocument();
  });

  it('shows the empty-state copy with the current query and folder scope', () => {
    render(<StateDisplay state="empty" query="report" directoryQuery="Work/Docs" />);
    expect(
      screen.getByText('No results for "report" in folder scope "Work/Docs"'),
    ).toBeInTheDocument();
  });

  it('shows generic empty-state copy when no query is present', () => {
    const { container } = render(<StateDisplay state="empty" />);
    expect(screen.getByText('Enter a keyword')).toBeInTheDocument();
    expect(screen.getByText('Supports fuzzy search by file or folder name')).toBeInTheDocument();
    expect(container.querySelectorAll('line')).toHaveLength(1);
  });

  it('keeps the no-results icon when a query has no matches', () => {
    const { container } = render(<StateDisplay state="empty" query="report" />);

    expect(container.querySelectorAll('line')).toHaveLength(3);
  });
});
