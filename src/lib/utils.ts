import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format a number with thousands separators */
export function formatNumber(n: number): string {
  return n.toLocaleString()
}

/** Calculate quota percentage — total quota = scriptKeys.length × 20_000 */
export function calcQuota(todayRequests: number, scriptKeysCount: number): {
  used: number
  total: number
  percentage: number
  isWarning: boolean
  isDanger: boolean
} {
  const total = Math.max(scriptKeysCount, 1) * 20_000
  const percentage = Math.min(Math.round((todayRequests / total) * 100), 100)
  return {
    used: todayRequests,
    total,
    percentage,
    isWarning: percentage >= 80,
    isDanger: percentage >= 95,
  }
}

/** Truncate a string to a maximum length */
export function truncate(str: string, max = 40): string {
  return str.length > max ? str.slice(0, max) + '…' : str
}

/** Parse the script_keys JSON array safely */
export function parseScriptKeys(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((k) => typeof k === 'string') : []
  } catch {
    return []
  }
}

/** Format relative time (e.g. "2 minutes ago") */
export function timeAgo(date: Date | string): string {
  const now = Date.now()
  const then = new Date(date).getTime()
  const diffMs = now - then
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  return new Date(date).toLocaleDateString()
}
