// ── Shared TypeScript types ──────────────────────────────────────────────────

export type CoreStatus = 'running' | 'stopped' | 'error' | 'starting'

/**
 * Supported core engine types.
 *
 * "goose"      — GooseRelayVPN: tunnels via Google Apps Script endpoints.
 *                CLI: ./goose-client -config <path>
 *                Config fields: socks_host, socks_port, google_host, sni, script_keys, tunnel_key
 *
 * "flowdriver" — FlowDriver: tunnels via Google Drive API (very different architecture).
 *                CLI: ./client -c <config> -gc <credentials.json>
 *                Config fields: listen_addr, storage_type, google_folder_id, refresh_rate_ms,
 *                               flush_rate_ms, transport{TargetIP, SNI, HostHeader}
 *                Auth: requires OAuth2 browser flow on first run (handled in-panel via stdin/SSE).
 *                      After first auth, a .token file is created next to credentials.json.
 *
 * When adding a new core type:
 *   1. Add the type literal here
 *   2. Add a Prisma model for its config (like FlowDriverConfig)
 *   3. Add config-writer branch in src/lib/config-writer.ts
 *   4. Add spawn-args branch in buildSpawnCommand (src/lib/process-manager.ts)
 *   5. Add API validation/upsert branch in src/app/api/cores/route.ts and [id]/route.ts
 *   6. Add UI form fields in src/components/cores/create-core-dialog.tsx and config-form.tsx
 */
export type CoreType = 'goose' | 'flowdriver'

export interface CoreConfigData {
  socksHost: string
  socksPort: number
  googleHost: string
  sni: string
  scriptKeys: string[]
  tunnelKey: string
  socksUser?: string
  socksPass?: string
}

export interface CoreWithDetails {
  id: string
  name: string
  description: string | null
  binaryPath: string
  coreType: CoreType
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
    socksUser: string
    socksPass: string
  } | null
  flowDriverConfig: {
    id: string
    listenAddr: string
    googleFolderId: string
    refreshRateMs: number
    flushRateMs: number
    transportTarget: string
    transportSni: string
    transportHost: string
    credentialsPath: string
    tokenPath: string
  } | null
  stats: {
    totalRequests: number
    todayRequests: number
    lastResetAt: string
  } | null
}

export interface LogEntry {
  level: 'info' | 'warn' | 'error' | 'oauth'
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
