'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import React from 'react'
import { Download, Pause, Play, Trash2, Terminal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { OAuthDialog } from '@/components/cores/oauth-dialog'
import { cn } from '@/lib/utils'

interface LogEntry {
  level: string
  message: string
  timestamp: string
}

interface LogViewerProps {
  coreId: string
  initialLogs?: LogEntry[]
  isRunning: boolean
  compact?: boolean
}

// ANSI escape code → color map (warm/rust palette)
const ANSI_COLORS: Record<number, string> = {
  30: '#50443A', 31: '#C04030', 32: '#5A8A38', 33: '#C08A20',
  34: '#4A6A8A', 35: '#8A4A6A', 36: '#3A8A7A', 37: '#C8B8A0',
  90: '#6A5A50', 91: '#E06050', 92: '#7AB050', 93: '#E0B040',
  94: '#6A8ABA', 95: '#B06A9A', 96: '#50B0A0', 97: '#E8D8C0',
}

/** Parse ANSI escape codes into React-renderable spans */
function parseAnsi(raw: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  // Strip CSI sequences we don't handle (cursor movement etc.)
  const text = raw.replace(/\x1b\[[0-9;]*[A-HJKSTfhilmnprsu]/g, (match) => {
    // keep color/style codes, strip others
    if (/\x1b\[[0-9;]*m/.test(match)) return match
    return ''
  })

  const segmentRe = /\x1b\[([0-9;]*)m/g
  let lastIndex = 0
  let currentColor: string | null = null
  let currentBold = false
  let match: RegExpExecArray | null

  while ((match = segmentRe.exec(text)) !== null) {
    // Text before this escape
    if (match.index > lastIndex) {
      const slice = text.slice(lastIndex, match.index)
      parts.push(
        <span key={parts.length} style={{ color: currentColor ?? undefined, fontWeight: currentBold ? 700 : undefined }}>
          {slice}
        </span>
      )
    }
    // Parse codes
    const codes = match[1].split(';').map(Number)
    for (const code of codes) {
      if (code === 0) { currentColor = null; currentBold = false }
      else if (code === 1) currentBold = true
      else if (ANSI_COLORS[code]) currentColor = ANSI_COLORS[code]
    }
    lastIndex = match.index + match[0].length
  }
  // Remaining text
  if (lastIndex < text.length) {
    parts.push(
      <span key={parts.length} style={{ color: currentColor ?? undefined, fontWeight: currentBold ? 700 : undefined }}>
        {text.slice(lastIndex)}
      </span>
    )
  }
  return parts.length ? parts : [text]
}

function levelBadgeStyle(level: string) {
  if (level === 'error') return 'bg-danger/15 text-danger border-danger/30'
  if (level === 'warn') return 'bg-warning/15 text-warning border-warning/30'
  return 'bg-bg-elevated text-text-muted border-border'
}

export function LogViewer({ coreId, initialLogs = [], isRunning, compact = false }: LogViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>(initialLogs)
  const [paused, setPaused] = useState(false)
  const [oauthUrl, setOauthUrl] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const pendingRef = useRef<LogEntry[]>([])

  const flush = useCallback(() => {
    if (pendingRef.current.length > 0) {
      setLogs((prev) => {
        const next = [...prev, ...pendingRef.current]
        pendingRef.current = []
        return next.slice(-2000) // keep last 2000 lines
      })
    }
  }, [])

  useEffect(() => {
    if (!isRunning) return

    const url = `/api/cores/${coreId}/logs`
    const es = new EventSource(url)

    es.onmessage = (e) => {
      try {
        const entry: LogEntry = JSON.parse(e.data)
        // FlowDriver OAuth URL — show dialog instead of logging
        if (entry.level === 'oauth') {
          setOauthUrl(entry.message)
          return
        }
        if (!paused) {
          pendingRef.current.push(entry)
        }
      } catch { /* skip malformed */ }
    }

    es.onerror = () => {
      // EventSource auto-reconnects — nothing to do
    }

    const interval = setInterval(flush, 200)

    return () => {
      es.close()
      clearInterval(interval)
      flush()
    }
  }, [coreId, isRunning, paused, flush])

  // Auto-scroll
  useEffect(() => {
    if (!paused) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, paused])

  function handleDownload() {
    const text = logs.map((l) => `[${l.timestamp}] [${l.level}] ${l.message}`).join('\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `goose-core-${coreId}.log`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-full">
      {/* FlowDriver OAuth dialog — shown when binary outputs a Google auth URL */}
      {oauthUrl && (
        <OAuthDialog
          coreId={coreId}
          authUrl={oauthUrl}
          onComplete={() => setOauthUrl(null)}
        />
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs text-text-muted font-mono">
            {logs.length} lines
            {isRunning && !paused && (
              <span className="ml-2 text-primary animate-pulse">● LIVE</span>
            )}
          </span>
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPaused((p) => !p)}
            title={paused ? 'Resume scroll' : 'Pause scroll'}
          >
            {paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            {paused ? 'Resume' : 'Pause'}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setLogs([])} title="Clear">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDownload} title="Download logs">
            <Download className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Log output — terminal style */}
      <div className={cn(
        'log-viewer flex-1 overflow-y-auto p-3 text-xs terminal-bg',
        compact ? 'min-h-40 max-h-56' : 'min-h-64 max-h-[520px]'
      )}>
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-24 gap-2 text-text-dim">
            <Terminal className="w-6 h-6" />
            <p className="text-xs tracking-widest uppercase" style={{fontSize:'0.6rem'}}>Waiting for output…</p>
          </div>
        ) : (
          logs.map((log, i) => {
            return (
            <div key={i} className={cn(
              'flex gap-2 px-1 py-0.5 leading-5 group hover:bg-white/[0.02]',
            )}>
              {/* Level badge */}
              <span className={cn(
                'flex-shrink-0 border px-1 text-[9px] uppercase font-bold leading-4 self-start mt-0.5 w-11 text-center',
                levelBadgeStyle(log.level)
              )}>
                {log.level.slice(0, 4)}
              </span>
              {/* Message with ANSI parsing */}
              <span className="text-text-base break-all opacity-85">
                {parseAnsi(log.message.replace(/^\[ggoose\]\s*/, '').trimEnd())}
              </span>
            </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
