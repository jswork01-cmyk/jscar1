/**
 * Formats any date string or Date object into South Korea Time (KST, UTC+9)
 * with the format 'yyyy-mm-dd'.
 */
export function formatKSTDate(dateStr: string | Date | undefined | null): string {
  if (!dateStr) return '';
  try {
    const str = String(dateStr).trim();

    // If it is an ISO/sheet time-only value, do not treat as a date
    if (str.startsWith('1899-12-30')) {
      return '';
    }

    // If it's already exactly yyyy-mm-dd, return it directly
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      return str;
    }
    
    // If it's yyyy.mm.dd or similar, replace dots with hyphens
    if (/^\d{4}\.\d{2}\.\d{2}$/.test(str)) {
      return str.replace(/\./g, '-');
    }

    const date = new Date(str);
    if (isNaN(date.getTime())) {
      // Regex fallback if Date constructor fails
      const match = str.match(/(\d{4})[-.](\d{1,2})[-.](\d{1,2})/);
      if (match) {
        const y = match[1];
        const m = match[2].padStart(2, '0');
        const d = match[3].padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
      return str;
    }

    // Use Intl.DateTimeFormat with Asia/Seoul to format to parts correctly
    const formatter = new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });

    const parts = formatter.formatToParts(date);
    const year = parts.find(p => p.type === 'year')?.value || '';
    const month = parts.find(p => p.type === 'month')?.value || '';
    const day = parts.find(p => p.type === 'day')?.value || '';
    return `${year}-${month}-${day}`;
  } catch (e) {
    return String(dateStr);
  }
}

/**
 * Extracts and formats time-only (HH:MM style) from raw strings.
 * Safely handles Google Sheets 1899 base date strings without shifts.
 */
export function formatKSTTimeOnly(timeStr: string | undefined | null): string {
  if (!timeStr) return '';
  try {
    const str = String(timeStr).trim();

    // If it's a standard ISO String or sheets time timestamp like "1899-12-30T14:45:00.000Z"
    const tIndex = str.indexOf('T');
    if (tIndex !== -1) {
      const timePart = str.substring(tIndex + 1);
      const match = timePart.match(/^(\d{1,2}):(\d{2})/);
      if (match) {
        return `${match[1].padStart(2, '0')}:${match[2]}`;
      }
    }

    // If it's structured like HH:MM:SS or HH:MM
    const matches = str.match(/^(\d{1,2}):(\d{2})/);
    if (matches) {
      return `${matches[1].padStart(2, '0')}:${matches[2]}`;
    }

    // Fallback using Date parser
    const date = new Date(str);
    if (!isNaN(date.getTime())) {
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    }

    return str;
  } catch (e) {
    return String(timeStr);
  }
}

/**
 * Formats a full date-time entry (useful for reservations, logs, etc.)
 * outputs 'yyyy-mm-dd hh:mm' or 'yyyy-mm-dd' accordingly.
 */
export function formatKSTDateTime(dateTimeStr: string | Date | undefined | null): string {
  if (!dateTimeStr) return '';
  try {
    const str = String(dateTimeStr).trim();

    // If it contains 1899 base date, it's a time-only value, render formatted time only
    if (str.startsWith('1899-12-30')) {
      return formatKSTTimeOnly(str);
    }

    const date = new Date(str);
    if (isNaN(date.getTime())) {
      return str; // Fallback
    }

    const formatter = new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    const parts = formatter.formatToParts(date);
    const year = parts.find(p => p.type === 'year')?.value || '';
    const month = parts.find(p => p.type === 'month')?.value || '';
    const day = parts.find(p => p.type === 'day')?.value || '';
    const hour = parts.find(p => p.type === 'hour')?.value || '00';
    const minute = parts.find(p => p.type === 'minute')?.value || '00';

    return `${year}-${month}-${day} ${hour}:${minute}`;
  } catch (e) {
    return String(dateTimeStr);
  }
}
