'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { ExternalLink, Copy, CheckCheck, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface OAuthDialogProps {
  coreId: string
  authUrl: string
  onComplete: () => void
}

export function OAuthDialog({ coreId, authUrl, onComplete }: OAuthDialogProps) {
  const [callbackUrl, setCallbackUrl] = useState('')
  const [sending, setSending] = useState(false)
  const [copied, setCopied] = useState(false)

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(authUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy to clipboard')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!callbackUrl.trim()) {
      toast.error('Please paste the callback URL')
      return
    }
    setSending(true)
    try {
      const res = await fetch(`/api/cores/${coreId}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callbackUrl: callbackUrl.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to send callback')
      toast.success('Authentication sent — FlowDriver is connecting…')
      onComplete()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-bg-base/90 backdrop-blur-sm" />

      {/* Dialog */}
      <div className="relative glass rounded-2xl w-full max-w-lg border border-primary/30">
        {/* Header */}
        <div className="flex items-center gap-3 p-5 border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Shield className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-text-base">Google Authentication Required</h2>
            <p className="text-xs text-text-muted mt-0.5">FlowDriver needs to access Google Drive</p>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Step 1 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0">1</span>
              <p className="text-xs font-medium text-text-base">Open this URL in your browser</p>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 min-w-0 bg-bg-elevated border border-border rounded-lg px-3 py-2 font-mono text-[10px] text-text-muted truncate">
                {authUrl}
              </div>
              <button
                onClick={copyUrl}
                title="Copy URL"
                className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border border-border text-text-muted hover:text-primary hover:border-primary/50 transition-colors"
              >
                {copied ? <CheckCheck className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <a
                href={authUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Open in browser"
                className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border border-border text-text-muted hover:text-primary hover:border-primary/50 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Step 2 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0">2</span>
              <p className="text-xs font-medium text-text-base">Sign in with your Google account and grant access</p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0">3</span>
              <p className="text-xs font-medium text-text-base">
                You&apos;ll be redirected to <code className="text-primary">http://localhost...</code> — copy the full URL from your browser and paste it below
              </p>
            </div>
            <p className="text-[10px] text-text-dim ml-7">
              The page may show an error — that&apos;s normal. Copy the URL from the address bar anyway.
            </p>
          </div>

          {/* Callback URL input */}
          <form onSubmit={handleSubmit} className="space-y-3 pt-1 border-t border-border">
            <Input
              label="Callback URL"
              placeholder="http://localhost?code=4/..."
              value={callbackUrl}
              onChange={(e) => setCallbackUrl(e.target.value)}
              className="font-mono text-xs"
            />
            <Button type="submit" loading={sending} className="w-full">
              Complete Authentication
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
