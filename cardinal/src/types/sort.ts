export type SortKey = 'filename' | 'extension' | 'fullPath' | 'size' | 'mtime' | 'ctime';

export type SortDirection = 'asc' | 'desc';

export type SortState = {
  key: SortKey;
  direction: SortDirection;
} | null;
