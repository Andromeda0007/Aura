/**
 * Centralized date handling: server sends UTC (often without "Z").
 * Parse as UTC and format in Indian Standard Time (IST).
 */

const IST_ZONE = 'Asia/Kolkata'
const LOCALE = 'en-IN'

/** Parse server datetime string as UTC (append Z if no timezone). */
export function parseAsUTC(dateString: string): Date {
  if (!dateString) return new Date()
  const s = String(dateString).trim()
  if (s.endsWith('Z') || s.includes('+') || /[+-]\d{2}:?\d{2}$/.test(s)) return new Date(s)
  return new Date(s + 'Z')
}

/** Format date only in IST (e.g. "04 Mar 2026"). */
export function formatDateIST(dateString: string): string {
  return parseAsUTC(dateString).toLocaleString(LOCALE, {
    timeZone: IST_ZONE,
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })
}

/** Format time only in IST (e.g. "06:21 pm"). */
export function formatTimeIST(dateString: string): string {
  return parseAsUTC(dateString).toLocaleString(LOCALE, {
    timeZone: IST_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

/** Format time with seconds in IST (e.g. for transcript). */
export function formatTimeWithSecondsIST(dateString: string): string {
  return parseAsUTC(dateString).toLocaleString(LOCALE, {
    timeZone: IST_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })
}

/** Relative time from now (e.g. "5m ago"); uses UTC parsing so diff is correct. */
export function timeAgoIST(isoStr: string): string {
  const diff = Math.floor((Date.now() - parseAsUTC(isoStr).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}
