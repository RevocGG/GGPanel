// ── Shared TypeScript types ──────────────────────────────────────────────────

export type CoreStatus = 'running' | 'stopped' | 'error' | 'starting'

export interface CoreConfigData {
  socksHost: string
  socksPort: number
  googleHost: string
  sni: string
  scriptKeys: string[]
  tunnelKey: string
}

export interface CoreWithDetails {
  id: string
  name: string
  description: string | null
  binaryPath: string
  status: CoreStatus
  pid: number | null
  createdAt: string
  updatedAt: string
  config: {
    id: string
    socksHost: string
    socksPort: number
    googleHost: string
    sni: string
    scriptKeys: string   // raw JSON string
    tunnelKey: string
  } | null
  stats: {
    totalRequests: number
    todayRequests: number
    lastResetAt: string
  } | null
}

export interface LogEntry {
  level: 'info' | 'warn' | 'error'
  message: string
  timestamp: string
}

export interface ApiResponse<T = unknown> {
  data?: T
  error?: string
  message?: string
}

export interface QuotaInfo {
  used: number
  total: number
  percentage: number
  isWarning: boolean
  isDanger: boolean
}
