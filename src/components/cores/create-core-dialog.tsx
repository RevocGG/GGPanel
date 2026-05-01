'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { X, Plus, Trash2, ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { CoreType } from '@/types'

// ── Goose schema ─────────────────────────────────────────────────────────────
const GooseSchema = z.object({
  name: z.string().min(1, 'Name is required').max(64),
  description: z.string().max(256).optional(),
  binaryPath: z.string().min(1, 'Binary is required'),
  socksHost: z.string().min(1, 'Required').default('127.0.0.1'),
  socksPort: z.coerce.number().int().min(1).max(65535).default(1080),
  googleHost: z.string().min(1, 'Required').default('216.239.38.120'),
  sniHosts: z.array(z.object({ value: z.string().min(1, 'Cannot be empty') }))
    .min(1, 'At least one SNI is required'),
  scriptKeys: z.array(z.object({ value: z.string().min(1, 'Cannot be empty') }))
    .min(1, 'At least one script key is required'),
  tunnelKey: z.string().min(1, 'Tunnel key is required'),
  socksUser: z.string().optional().default(''),
  socksPass: z.string().optional().default(''),
})

// ── FlowDriver schema ────────────────────────────────────────────────────────
const FlowDriverCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(64),
  description: z.string().max(256).optional(),
  binaryPath: z.string().min(1, 'Binary is required'),
  listenAddr: z.string().min(1, 'Required').default('127.0.0.1:1080'),
  googleFolderId: z.string().default(''),
  refreshRateMs: z.coerce.number().int().min(50).max(10000).default(200),
  flushRateMs: z.coerce.number().int().min(50).max(10000).default(300),
  transportTarget: z.string().min(1, 'Required').default('216.239.38.120:443'),
  transportSni: z.string().min(1, 'Required').default('google.com'),
  transportHost: z.string().min(1, 'Required').default('www.googleapis.com'),
  credentialsPath: z.string().default(''),
})

type GooseFormData = z.infer<typeof GooseSchema>
type FlowDriverFormData = z.infer<typeof FlowDriverCreateSchema>

interface Props {
  binaries: string[]
  onClose: () => void
  prefill?: {
    name?: string
    binaryPath?: string
    socksHost?: string
    socksPort?: number
    googleHost?: string
    sni?: string
    scriptKeys?: string[]
    tunnelKey?: string
    socksUser?: string
    socksPass?: string
  }
}

// ── Type selector ─────────────────────────────────────────────────────────────
function CoreTypeSelector({ onSelect }: { onSelect: (t: CoreType) => void }) {
  return (
    <div className="p-5 space-y-4">
      <p className="text-xs text-text-muted">Choose which core engine to use for this core:</p>
      <div className="grid grid-cols-1 gap-3">
        <button
          type="button"
          onClick={() => onSelect('goose')}
          className="text-left p-4 rounded-xl border border-border hover:border-primary/50 bg-bg-elevated hover:bg-bg-elevated/80 transition-all group"
        >
          <div className="font-semibold text-sm text-text-base group-hover:text-primary transition-colors">
            🪿 GooseRelayVPN
          </div>
          <div className="text-xs text-text-muted mt-1">
            Tunnels traffic via Google Apps Script endpoints. Requires deployment IDs and a tunnel key.
          </div>
          <div className="text-[10px] text-text-dim mt-2 font-mono">CLI: -config &lt;path&gt;</div>
        </button>

        <button
          type="button"
          onClick={() => onSelect('flowdriver')}
          className="text-left p-4 rounded-xl border border-border hover:border-primary/50 bg-bg-elevated hover:bg-bg-elevated/80 transition-all group"
        >
          <div className="font-semibold text-sm text-text-base group-hover:text-primary transition-colors">
            🌊 FlowDriver
          </div>
          <div className="text-xs text-text-muted mt-1">
            Tunnels traffic via Google Drive API. Requires a Google OAuth2 credentials.json file.
            First start triggers an in-panel browser auth flow.
          </div>
          <div className="text-[10px] text-text-dim mt-2 font-mono">CLI: -c &lt;config&gt; -gc &lt;credentials.json&gt;</div>
        </button>
      </div>
    </div>
  )
}

// ── Goose form ────────────────────────────────────────────────────────────────
function GooseForm({ binaries, onClose, prefill, onBack }: {
  binaries: string[]
  onClose: () => void
  prefill?: Props['prefill']
  onBack: () => void
}) {
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  const { register, control, handleSubmit, formState: { errors } } = useForm<GooseFormData>({
    resolver: zodResolver(GooseSchema),
    defaultValues: {
      name: prefill?.name ?? '',
      socksHost: prefill?.socksHost ?? '127.0.0.1',
      socksPort: prefill?.socksPort ?? 1080,
      googleHost: prefill?.googleHost ?? '216.239.38.120',
      sniHosts: (() => {
        if (!prefill?.sni) return [{ value: 'www.google.com' }]
        try {
          const arr = JSON.parse(prefill.sni)
          if (Array.isArray(arr)) return arr.map((v: string) => ({ value: v }))
        } catch { }
        return [{ value: prefill.sni }]
      })(),
      binaryPath: prefill?.binaryPath ?? binaries[0] ?? '',
      scriptKeys: prefill?.scriptKeys?.length
        ? prefill.scriptKeys.map((v) => ({ value: v }))
        : [{ value: '' }],
      tunnelKey: prefill?.tunnelKey ?? '',
      socksUser: prefill?.socksUser ?? '',
      socksPass: prefill?.socksPass ?? '',
    },
  })
  const { fields: sniFields, append: appendSni, remove: removeSni } = useFieldArray({ control, name: 'sniHosts' })
  const { fields, append, remove } = useFieldArray({ control, name: 'scriptKeys' })

  async function onSubmit(data: GooseFormData) {
    setSaving(true)
    try {
      const sniValues = data.sniHosts.map((h) => h.value)
      const sni = sniValues.length === 1 ? sniValues[0] : JSON.stringify(sniValues)
      const res = await fetch('/api/cores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coreType: 'goose',
          ...data,
          sni,
          scriptKeys: data.scriptKeys.map((k) => k.value),
          socksUser: data.socksUser ?? '',
          socksPass: data.socksPass ?? '',
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Create failed')
      toast.success(`Core "${data.name}" created`)
      router.refresh()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create core')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <button type="button" onClick={onBack} className="text-text-muted hover:text-text-base transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs text-text-muted">🪿 GooseRelayVPN</span>
      </div>
      <Input label="Name" error={errors.name?.message} placeholder="e.g. Core 1" {...register('name')} />
      <Input label="Description (optional)" {...register('description')} />
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-text-muted">Binary</label>
        <select {...register('binaryPath')} className="h-9 w-full rounded-lg border border-border bg-bg-elevated px-3 text-sm text-text-base focus:outline-none focus:border-primary transition-colors">
          {binaries.length === 0
            ? <option value="">Upload a binary to data/cores/ first</option>
            : binaries.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        {errors.binaryPath && <p className="text-xs text-danger">{errors.binaryPath.message}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="SOCKS Host" {...register('socksHost')} />
        <Input label="SOCKS Port" type="number" {...register('socksPort')} />
      </div>
      <Input label="Google Host" {...register('googleHost')} />
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-text-muted">SNI Host(s)</label>
          <Button type="button" variant="ghost" size="sm" onClick={() => appendSni({ value: '' })}>
            <Plus className="w-3.5 h-3.5" /> Add
          </Button>
        </div>
        {sniFields.map((f, i) => (
          <div key={f.id} className="flex gap-2 items-start">
            <div className="flex-1">
              <Input
                placeholder="www.google.com"
                error={errors.sniHosts?.[i]?.value?.message}
                {...register(`sniHosts.${i}.value`)}
              />
            </div>
            <button
              type="button"
              onClick={() => removeSni(i)}
              className="h-9 w-9 flex items-center justify-center rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {typeof errors.sniHosts?.message === 'string' && (
          <p className="text-xs text-danger">{errors.sniHosts.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-text-muted">Script Keys</label>
          <Button type="button" variant="ghost" size="sm" onClick={() => append({ value: '' })}>
            <Plus className="w-3.5 h-3.5" /> Add
          </Button>
        </div>
        {fields.map((f, i) => (
          <div key={f.id} className="flex gap-2 items-start">
            <div className="flex-1">
              <Input
                placeholder="AKfycb..."
                error={errors.scriptKeys?.[i]?.value?.message}
                {...register(`scriptKeys.${i}.value`)}
              />
            </div>
            <button
              type="button"
              onClick={() => remove(i)}
              className="h-9 w-9 flex items-center justify-center rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {typeof errors.scriptKeys?.message === 'string' && (
          <p className="text-xs text-danger">{errors.scriptKeys.message}</p>
        )}
      </div>
      <Input
        label="Tunnel Key"
        type="password"
        placeholder="Required"
        error={errors.tunnelKey?.message}
        {...register('tunnelKey')}
      />
      <div className="space-y-2">
        <label className="text-xs font-medium text-text-muted">SOCKS5 Authentication (optional)</label>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Username" placeholder="Leave empty to disable" {...register('socksUser')} />
          <Input label="Password" type="password" placeholder="Leave empty to disable" {...register('socksPass')} />
        </div>
        <p className="text-[10px] text-text-dim">RFC 1929 SOCKS5 auth — only set if your client requires credentials.</p>
      </div>
      <div className="flex justify-end gap-3 pt-2 border-t border-border">
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={saving}>Create Core</Button>
      </div>
    </form>
  )
}

// ── Credentials.json upload/path picker (reused in create + edit forms) ──────
export function CredentialsField({
  coreId,
  value,
  onChange,
  error,
}: {
  coreId?: string
  value: string
  onChange: (path: string) => void
  error?: string
}) {
  const [uploading, setUploading] = useState(false)
  const [savedPath, setSavedPath] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      if (coreId) form.append('coreId', coreId)
      const res = await fetch('/api/credentials/upload', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Upload failed')
      onChange(json.path)
      setSavedPath(json.path)
      toast.success('credentials.json uploaded')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-xs font-bold text-text-dim tracking-widest uppercase" style={{ fontSize: '0.6rem' }}>
        Credentials.json
      </label>

      {/* Upload button */}
      <div className="flex gap-2 items-center">
        <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFile} />
        <Button
          type="button"
          variant="outline"
          size="sm"
          loading={uploading}
          onClick={() => fileRef.current?.click()}
        >
          Upload credentials.json
        </Button>
        <span className="text-text-dim" style={{ fontSize: '0.6rem' }}>or enter path below</span>
      </div>

      {/* Saved path feedback */}
      {savedPath && (
        <div className="text-xs text-success font-mono bg-success/5 border border-success/20 px-2 py-1.5 break-all">
          ✓ Saved to: {savedPath}
        </div>
      )}

      {/* Manual path input */}
      <Input
        placeholder="C:\path\to\credentials.json or /path/to/credentials.json"
        value={value}
        onChange={(e) => { onChange(e.target.value); setSavedPath(null) }}
        error={error}
      />
      <p className="text-text-dim" style={{ fontSize: '0.6rem', letterSpacing: '0.06em' }}>
        OAuth2 credentials from Google Cloud Console. Required before starting. On first start,
        a browser auth flow will appear in the Logs tab.
      </p>
    </div>
  )
}

// ── FlowDriver form ───────────────────────────────────────────────────────────
function FlowDriverForm({ binaries, onClose, onBack }: {
  binaries: string[]
  onClose: () => void
  onBack: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [credentialsPath, setCredentialsPath] = useState('')
  const router = useRouter()

  const { register, handleSubmit, formState: { errors } } = useForm<FlowDriverFormData>({
    resolver: zodResolver(FlowDriverCreateSchema),
    defaultValues: {
      listenAddr: '127.0.0.1:1080',
      googleFolderId: '',
      refreshRateMs: 200,
      flushRateMs: 300,
      transportTarget: '216.239.38.120:443',
      transportSni: 'google.com',
      transportHost: 'www.googleapis.com',
      credentialsPath: '',
      binaryPath: binaries[0] ?? '',
    },
  })

  async function onSubmit(data: FlowDriverFormData) {
    setSaving(true)
    try {
      const res = await fetch('/api/cores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coreType: 'flowdriver', ...data, credentialsPath }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Create failed')
      toast.success(`FlowDriver core "${data.name}" created`)
      router.refresh()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create core')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <button type="button" onClick={onBack} className="text-text-muted hover:text-text-base transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs text-text-muted">🌊 FlowDriver</span>
      </div>

      <Input label="Name" error={errors.name?.message} placeholder="e.g. FlowDriver 1" {...register('name')} />
      <Input label="Description (optional)" {...register('description')} />

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-text-muted">Binary</label>
        <select {...register('binaryPath')} className="h-9 w-full rounded-lg border border-border bg-bg-elevated px-3 text-sm text-text-base focus:outline-none focus:border-primary transition-colors">
          {binaries.length === 0
            ? <option value="">Upload a binary to data/cores/ first</option>
            : binaries.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        {errors.binaryPath && <p className="text-xs text-danger">{errors.binaryPath.message}</p>}
      </div>

      <Input label="Listen Address" placeholder="127.0.0.1:1080" error={errors.listenAddr?.message} {...register('listenAddr')} />

      <div>
        <Input
          label="Google Folder ID (optional)"
          placeholder="Leave empty — auto-created on first run"
          {...register('googleFolderId')}
        />
        <p className="text-[10px] text-text-dim mt-1">If empty, FlowDriver creates a &quot;Flow-Data&quot; folder automatically.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input label="Refresh Rate (ms)" type="number" {...register('refreshRateMs')} />
        <Input label="Flush Rate (ms)" type="number" {...register('flushRateMs')} />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-bold text-text-dim tracking-widest uppercase" style={{ fontSize: '0.6rem' }}>Transport</label>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Target IP:Port" placeholder="216.239.38.120:443" error={errors.transportTarget?.message} {...register('transportTarget')} />
          <Input label="SNI" placeholder="google.com" error={errors.transportSni?.message} {...register('transportSni')} />
        </div>
        <Input label="Host Header" placeholder="www.googleapis.com" error={errors.transportHost?.message} {...register('transportHost')} />
      </div>

      <CredentialsField value={credentialsPath} onChange={setCredentialsPath} />

      <div className="flex justify-end gap-3 pt-2 border-t border-border">
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={saving}>Create Core</Button>
      </div>
    </form>
  )
}

// ── Main dialog ───────────────────────────────────────────────────────────────
export function CreateCoreDialog({ binaries, onClose, prefill }: Props) {
  const [selectedType, setSelectedType] = useState<CoreType | null>(
    prefill ? 'goose' : null
  )

  const title = prefill ? 'Clone Core'
    : selectedType === null ? 'Create Core — Select Type'
    : selectedType === 'goose' ? 'Create Core — GooseRelayVPN'
    : 'Create Core — FlowDriver'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-bg-base/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-base font-semibold text-text-base">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-base hover:bg-bg-elevated transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {selectedType === null && (
          <CoreTypeSelector onSelect={setSelectedType} />
        )}
        {selectedType === 'goose' && (
          <GooseForm binaries={binaries} onClose={onClose} prefill={prefill} onBack={() => setSelectedType(null)} />
        )}
        {selectedType === 'flowdriver' && (
          <FlowDriverForm binaries={binaries} onClose={onClose} onBack={() => setSelectedType(null)} />
        )}
      </div>
    </div>
  )
}
