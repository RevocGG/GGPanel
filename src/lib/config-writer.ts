import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import type { CoreConfig, FlowDriverConfig } from '@prisma/client'

const getConfigsDir = () =>
  process.env.CONFIGS_DIR ?? path.join(process.cwd(), 'data', 'configs')

/** Write a JSON config file for a Goose core and return the file path */
export async function writeConfigFile(config: CoreConfig): Promise<string> {
  const dir = getConfigsDir()
  await mkdir(dir, { recursive: true })

  const configPath = path.join(dir, `${config.coreId}.json`)

  let scriptKeys: string[] = []
  try {
    scriptKeys = JSON.parse(config.scriptKeys)
  } catch {
    scriptKeys = []
  }

  // sni can be stored as plain string OR JSON array (for multi-SNI)
  let sniValue: string | string[]
  try {
    const parsed = JSON.parse(config.sni)
    sniValue = Array.isArray(parsed) ? parsed : config.sni
  } catch {
    sniValue = config.sni
  }

  const configData: Record<string, unknown> = {
    socks_host: config.socksHost,
    socks_port: config.socksPort,
    google_host: config.googleHost,
    sni: sniValue,
    script_keys: scriptKeys,
    tunnel_key: config.tunnelKey,
  }

  // Optional SOCKS5 authentication — omit if not set
  if (config.socksUser) configData.socks_user = config.socksUser
  if (config.socksPass) configData.socks_pass = config.socksPass

  await writeFile(configPath, JSON.stringify(configData, null, 2), 'utf-8')
  return configPath
}

/**
 * Write a JSON config file for a FlowDriver core and return the file path.
 *
 * FlowDriver config format is completely different from Goose:
 *   - Uses Google Drive API (not Apps Script)
 *   - listen_addr combines host + port
 *   - transport block with TargetIP/SNI/HostHeader
 *   - Requires separate credentials.json file passed via -gc CLI flag
 */
export async function writeFlowDriverConfigFile(config: FlowDriverConfig): Promise<string> {
  const dir = getConfigsDir()
  await mkdir(dir, { recursive: true })

  const configPath = path.join(dir, `${config.coreId}-flowdriver.json`)

  const configData = {
    listen_addr: config.listenAddr,
    storage_type: 'google',
    google_folder_id: config.googleFolderId || undefined,
    refresh_rate_ms: config.refreshRateMs,
    flush_rate_ms: config.flushRateMs,
    transport: {
      TargetIP: config.transportTarget,
      SNI: config.transportSni,
      HostHeader: config.transportHost,
      InsecureSkipVerify: false,
    },
  }

  await writeFile(configPath, JSON.stringify(configData, null, 2), 'utf-8')
  return configPath
}
