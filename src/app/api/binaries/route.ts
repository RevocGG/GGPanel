import { NextResponse } from 'next/server'
import { readdir } from 'fs/promises'
import path from 'path'
import { statSync } from 'fs'

export async function GET() {
  const coresDir = process.env.CORES_DIR ?? path.join(process.cwd(), 'data', 'cores')
  try {
    const files = await readdir(coresDir)
    const binaries = files
      .filter((f) => !f.startsWith('.'))
      .map((f) => {
        try {
          const st = statSync(path.join(coresDir, f))
          return { name: f, size: st.size, path: f }
        } catch {
          return { name: f, size: 0, path: f }
        }
      })
    return NextResponse.json({ data: binaries })
  } catch {
    return NextResponse.json({ data: [] })
  }
}
