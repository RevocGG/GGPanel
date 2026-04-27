'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import React from 'react'
import { Download, Pause, Play, Trash2, Terminal } from 'lucide-react'
import { Button } from '@/components/ui/button'
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

// ANSI escape code → Tailwind color map
const ANSI_COLORS: Record<number, string> = {
  30: '#64748B', 31: '#EF4444', 32: '#10B981', 33: '#F59E0B',
  34: '#60A5FA', 35: '#A855F7', 36: '#22D3EE', 37: '#E2E8F0',
  90: '#475569', 91: '#F87171', 92: '#34D399', 93: '#FCD34D',
  94: '#93C5FD', 95: '#C084FC', 96: '#67E8F9', 97: '#F1F5F9',
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
  if (level === 'error') return 'bg-red-500/20 text-red-400 border-red-500/30'
  if (level === 'warn') return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
  return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
}

export function LogViewer({ coreId, initialLogs = [], isRunning, compact = false }: LogViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>(initialLogs)
  const [paused, setPaused] = useState(false)
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
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-xs text-text-muted font-mono">
            {logs.length} lines
            {isRunning && !paused && (
              <span className="ml-2 text-cyan-400 animate-pulse">● LIVE</span>
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
        'log-viewer flex-1 overflow-y-auto rounded-xl p-3 text-xs',
        'bg-[#050B1F] border border-cyan-500/10',
        compact ? 'min-h-40 max-h-56' : 'min-h-64 max-h-[520px]'
      )}>
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-24 gap-2 text-slate-600">
            <Terminal className="w-6 h-6" />
            <p className="text-xs">Waiting for output…</p>
          </div>
        ) : (
          logs.map((log, i) => (
            <div key={i} className={cn(
              'flex gap-2 px-1.5 py-0.5 rounded leading-5 group hover:bg-white/[0.03]',
            )}>
              {/* Time */}
              <span className="text-slate-600 flex-shrink-0 font-mono tabular-nums w-[68px]">
                {log.timestamp.slice(11, 19)}
              </span>
              {/* Level badge */}
              <span className={cn(
                'flex-shrink-0 border rounded px-1 text-[10px] uppercase font-bold leading-4 self-start mt-0.5 w-11 text-center',
                levelBadgeStyle(log.level)
              )}>
                {log.level.slice(0, 4)}
              </span>
              {/* Message with ANSI parsing */}
              <span className="text-slate-300 break-all">
                {parseAnsi(log.message)}
              </span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
