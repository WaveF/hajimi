import { describe, expect, it } from 'vitest';
import { formatFileSize, formatKB } from '../format';

describe('formatFileSize', () => {
  it('uses bytes for values smaller than one kilobyte', () => {
    expect(formatFileSize(0)).toBe('0 bytes');
    expect(formatFileSize(512)).toBe('512 bytes');
  });

  it('automatically selects KB, MB, and GB', () => {
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(formatFileSize(1024 ** 2)).toBe('1 MB');
    expect(formatFileSize(1024 ** 3)).toBe('1 GB');
  });

  it('returns null for nullish, negative, or non-finite inputs', () => {
    expect(formatFileSize(null)).toBeNull();
    expect(formatFileSize(undefined)).toBeNull();
    expect(formatFileSize(-1)).toBeNull();
    expect(formatFileSize(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe('formatKB', () => {
  it('formats whole kilobytes without decimal digits', () => {
    expect(formatKB(2048)).toBe('2.0 KB');
  });

  it('formats small values with a single decimal place', () => {
    expect(formatKB(1536)).toBe('1.5 KB');
  });

  it('returns null for nullish or non-finite inputs', () => {
    expect(formatKB(null)).toBeNull();
    expect(formatKB(undefined)).toBeNull();
    expect(formatKB(Number.POSITIVE_INFINITY)).toBeNull();
  });
});
