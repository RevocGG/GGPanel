import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

const CONFIGS_DIR = process.env.CONFIGS_DIR ?? path.join(process.cwd(), 'data', 'configs')

/**
 * POST /api/credentials/upload
 * Accepts multipart/form-data with field "file" (the credentials.json)
 * and optional "coreId" to name the file.
 * Returns the saved file path.
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file')
    const coreId = formData.get('coreId')?.toString() ?? 'unknown'

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate it's a JSON file
    if (!file.name.endsWith('.json')) {
      return NextResponse.json({ error: 'Only .json files are accepted' }, { status: 400 })
    }

    // Validate file size (max 64 KB)
    if (file.size > 64 * 1024) {
      return NextResponse.json({ error: 'File too large (max 64 KB)' }, { status: 400 })
    }

    const text = await file.text()

    // Validate it's valid JSON
    try {
      JSON.parse(text)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON file' }, { status: 400 })
    }

    await mkdir(CONFIGS_DIR, { recursive: true })

    const fileName = `credentials-${coreId}.json`
    const savePath = path.join(CONFIGS_DIR, fileName)
    await writeFile(savePath, text, 'utf-8')

    return NextResponse.json({ path: savePath, fileName })
  } catch {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
