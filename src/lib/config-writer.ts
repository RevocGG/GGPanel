import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import type { CoreConfig } from '@prisma/client'

const getConfigsDir = () =>
  process.env.CONFIGS_DIR ?? path.join(process.cwd(), 'data', 'configs')

/** Write a JSON config file for a core and return the file path */
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

  const configData = {
    socks_host: config.socksHost,
    socks_port: config.socksPort,
    google_host: config.googleHost,
    sni: config.sni,
    script_keys: scriptKeys,
    tunnel_key: config.tunnelKey,
  }

  await writeFile(configPath, JSON.stringify(configData, null, 2), 'utf-8')
  return configPath
}
