import { NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'fs'
import path from 'path'

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), 'data')
const LOG_FILE = path.join(DATA_DIR, 'panel.log')

// Return last N lines of the panel log as JSON
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const lines = Math.min(parseInt(searchParams.get('lines') ?? '200', 10), 1000)

  if (!existsSync(LOG_FILE)) {
    return NextResponse.json({ data: [] })
  }

  try {
    const raw = readFileSync(LOG_FILE, 'utf8')
    const parsed = raw
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        try { return JSON.parse(line) } catch { return { level: 'info', message: line, timestamp: '' } }
      })
      .slice(-lines)
    return NextResponse.json({ data: parsed })
  } catch {
    return NextResponse.json({ error: 'Failed to read panel log' }, { status: 500 })
  }
}

// Clear the log file
export async function DELETE() {
  try {
    if (existsSync(LOG_FILE)) {
      const { writeFileSync } = await import('fs')
      writeFileSync(LOG_FILE, '', 'utf8')
    }
    return NextResponse.json({ message: 'Log cleared' })
  } catch {
    return NextResponse.json({ error: 'Failed to clear log' }, { status: 500 })
  }
}
