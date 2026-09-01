const FILE_SIZE_UNITS = ['bytes', 'KB', 'MB', 'GB', 'TB', 'PB'] as const;
const BYTES_PER_KILOBYTE = 1024;

function formatSizeValue(value: number): string {
  if (value < 10 && !Number.isInteger(value)) {
    return value.toFixed(1);
  }

  return Math.round(value).toString();
}

// Format bytes using the largest useful unit, similar to Finder's compact display.
export function formatFileSize(bytes: number | null | undefined): string | null {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return null;

  let unitIndex = 0;
  let value = bytes;
  while (value >= BYTES_PER_KILOBYTE && unitIndex < FILE_SIZE_UNITS.length - 1) {
    value /= BYTES_PER_KILOBYTE;
    unitIndex += 1;
  }

  return `${formatSizeValue(value)} ${FILE_SIZE_UNITS[unitIndex]}`;
}

// Format bytes into KB with one decimal place (legacy function)
export function formatKB(bytes: number | null | undefined): string | null {
  if (bytes == null || !Number.isFinite(bytes)) return null;
  const kb = bytes / 1024;
  return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
}

// Format timestamp (in seconds) as YYYY-MM-DD HH:mm:ss
export function formatTimestamp(timestampSec: number | null | undefined): string | null {
  if (timestampSec == null || !Number.isFinite(timestampSec)) return null;
  const date = new Date(timestampSec * 1000);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
