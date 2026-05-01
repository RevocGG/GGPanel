'use client'

import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState, useRef } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, RefreshCw } from 'lucide-react'
import { CredentialsField } from '@/components/cores/create-core-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { CoreType } from '@/types'

// ── Goose schema ──────────────────────────────────────────────────────────────
const GooseConfigSchema = z.object({
  socksHost: z.string().min(1, 'Required'),
  socksPort: z.coerce.number().int().min(1).max(65535),
  googleHost: z.string().min(1, 'Required'),
  sniHosts: z.array(z.object({ value: z.string().min(1, 'Cannot be empty') }))
    .min(1, 'At least one SNI is required'),
  scriptKeys: z.array(z.object({ value: z.string().min(1, 'Cannot be empty') })),
  tunnelKey: z.string().min(1, 'Required'),
  binaryPath: z.string().min(1, 'Required'),
  socksUser: z.string().optional().default(''),
  socksPass: z.string().optional().default(''),
})

// ── FlowDriver schema ─────────────────────────────────────────────────────────
const FlowDriverConfigSchema = z.object({
  binaryPath: z.string().min(1, 'Required'),
  listenAddr: z.string().min(1, 'Required'),
  googleFolderId: z.string().default(''),
  refreshRateMs: z.coerce.number().int().min(50).max(10000),
  flushRateMs: z.coerce.number().int().min(50).max(10000),
  transportTarget: z.string().min(1, 'Required'),
  transportSni: z.string().min(1, 'Required'),
  transportHost: z.string().min(1, 'Required'),
  credentialsPath: z.string().default(''),
})

type GooseFormData = z.infer<typeof GooseConfigSchema>
type FlowDriverFormData = z.infer<typeof FlowDriverConfigSchema>

function generateKey(): string {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// ── Shared binary select ──────────────────────────────────────────────────────
function BinarySelect({ binaries, value, onChange, error }: {
  binaries: string[]
  value: string
  onChange: (v: string) => void
  error?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-bold text-text-dim tracking-widest uppercase" style={{ fontSize: '0.6rem' }}>Binary</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-full border border-border bg-bg-elevated px-3 text-xs text-text-base focus:outline-none focus:border-primary transition-colors font-mono"
      >
        {binaries.length === 0
          ? <option value="">No binaries in data/cores/</option>
          : binaries.map((b) => <option key={b} value={b}>{b}</option>)}
      </select>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}

// ── Goose config form ─────────────────────────────────────────────────────────
function GooseConfigForm({ coreId, binaries, defaults, onSaved }: {
  coreId: string
  binaries: string[]
  defaults: GooseFormData
  onSaved?: () => void
}) {
  const [saving, setSaving] = useState(false)
  const { register, control, handleSubmit, setValue, watch, formState: { errors, isDirty } } = useForm<GooseFormData>({
    resolver: zodResolver(GooseConfigSchema),
    defaultValues: defaults,
  })
  const { fields: sniFields, append: appendSni, remove: removeSni } = useFieldArray({ control, name: 'sniHosts' })
  const { fields, append, remove } = useFieldArray({ control, name: 'scriptKeys' })
  const binaryPath = watch('binaryPath')

  async function onSubmit(data: GooseFormData) {
    setSaving(true)
    try {
      const sniValues = data.sniHosts.map((h) => h.value)
      const sni = sniValues.length === 1 ? sniValues[0] : JSON.stringify(sniValues)
      const res = await fetch(`/api/cores/${coreId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coreType: 'goose',
          binaryPath: data.binaryPath,
          socksHost: data.socksHost,
          socksPort: data.socksPort,
          googleHost: data.googleHost,
          sni,
          scriptKeys: data.scriptKeys.map((k) => k.value),
          tunnelKey: data.tunnelKey,
          socksUser: data.socksUser ?? '',
          socksPass: data.socksPass ?? '',
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Save failed')
      toast.success('Configuration saved')
      onSaved?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <BinarySelect
        binaries={binaries}
        value={binaryPath}
        onChange={(v) => setValue('binaryPath', v, { shouldDirty: true })}
        error={errors.binaryPath?.message}
      />
      <div className="grid grid-cols-2 gap-4">
        <Input label="SOCKS Host" error={errors.socksHost?.message} {...register('socksHost')} />
        <Input label="SOCKS Port" type="number" error={errors.socksPort?.message} {...register('socksPort')} />
      </div>
      <Input label="Google Host (IP)" error={errors.googleHost?.message} {...register('googleHost')} />
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-text-dim tracking-widest uppercase" style={{ fontSize: '0.6rem' }}>
            SNI Host(s)
          </label>
          <Button type="button" variant="ghost" size="sm" onClick={() => appendSni({ value: '' })}>
            <Plus className="w-3 h-3" /> Add
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
              className="h-8 w-8 flex items-center justify-center text-text-muted hover:text-danger hover:bg-danger/10 transition-colors flex-shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        {typeof errors.sniHosts?.message === 'string' && (
          <p className="text-xs text-danger">{errors.sniHosts.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-text-dim tracking-widest uppercase" style={{ fontSize: '0.6rem' }}>
            Script Keys ({fields.length})
          </label>
          <Button type="button" variant="ghost" size="sm" onClick={() => append({ value: '' })}>
            <Plus className="w-3 h-3" /> Add key
          </Button>
        </div>
        {fields.length === 0 && <p className="text-xs text-text-dim">No deployment IDs added yet</p>}
        <div className="space-y-2">
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
                className="h-8 w-8 flex items-center justify-center text-text-muted hover:text-danger hover:bg-danger/10 transition-colors flex-shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-text-dim tracking-widest uppercase" style={{ fontSize: '0.6rem' }}>Tunnel Key</label>
          <button
            type="button"
            className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
            style={{ fontSize: '0.6rem' }}
            onClick={() => setValue('tunnelKey', generateKey(), { shouldDirty: true })}
          >
            <RefreshCw className="w-2.5 h-2.5" /> Generate
          </button>
        </div>
        <Input
          type="password"
          placeholder="64-char hex key"
          error={errors.tunnelKey?.message}
          {...register('tunnelKey')}
        />
        <p className="text-text-dim" style={{ fontSize: '0.6rem', letterSpacing: '0.06em' }}>
          Must match the key on the VPS server. Never share.
        </p>
      </div>
      <div className="space-y-2">
        <label className="text-xs font-bold text-text-dim tracking-widest uppercase" style={{ fontSize: '0.6rem' }}>SOCKS5 Auth (optional)</label>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Username" placeholder="Leave empty to disable" {...register('socksUser')} />
          <Input label="Password" type="password" placeholder="Leave empty to disable" {...register('socksPass')} />
        </div>
        <p className="text-text-dim" style={{ fontSize: '0.6rem', letterSpacing: '0.06em' }}>RFC 1929 SOCKS5 auth — only set if your client requires credentials.</p>
      </div>
      <Button type="submit" loading={saving} disabled={!isDirty}>Save changes</Button>
    </form>
  )
}

// ── FlowDriver config form ────────────────────────────────────────────────────
function FlowDriverConfigForm({ coreId, binaries, defaults, onSaved }: {
  coreId: string
  binaries: string[]
  defaults: FlowDriverFormData
  onSaved?: () => void
}) {
  const [saving, setSaving] = useState(false)
  const { register, handleSubmit, setValue, watch, formState: { errors, isDirty } } = useForm<FlowDriverFormData>({
    resolver: zodResolver(FlowDriverConfigSchema),
    defaultValues: defaults,
  })
  const binaryPath = watch('binaryPath')

  async function onSubmit(data: FlowDriverFormData) {
    setSaving(true)
    try {
      const res = await fetch(`/api/cores/${coreId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coreType: 'flowdriver', ...data }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Save failed')
      toast.success('Configuration saved')
      onSaved?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <BinarySelect
        binaries={binaries}
        value={binaryPath}
        onChange={(v) => setValue('binaryPath', v, { shouldDirty: true })}
        error={errors.binaryPath?.message}
      />
      <Input label="Listen Address" placeholder="127.0.0.1:1080" error={errors.listenAddr?.message} {...register('listenAddr')} />
      <Input
        label="Google Folder ID (optional)"
        placeholder="Leave empty — auto-created"
        {...register('googleFolderId')}
      />
      <div className="grid grid-cols-2 gap-4">
        <Input label="Refresh Rate (ms)" type="number" {...register('refreshRateMs')} />
        <Input label="Flush Rate (ms)" type="number" {...register('flushRateMs')} />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-bold text-text-dim tracking-widest uppercase" style={{ fontSize: '0.6rem' }}>Transport</label>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Target IP:Port" error={errors.transportTarget?.message} {...register('transportTarget')} />
          <Input label="SNI" error={errors.transportSni?.message} {...register('transportSni')} />
        </div>
        <Input label="Host Header" error={errors.transportHost?.message} {...register('transportHost')} />
      </div>
      <CredentialsField
        coreId={coreId}
        value={watch('credentialsPath')}
        onChange={(v) => setValue('credentialsPath', v, { shouldDirty: true })}
        error={errors.credentialsPath?.message}
      />
      <Button type="submit" loading={saving} disabled={!isDirty}>Save changes</Button>
    </form>
  )
}

// ── Public interface ──────────────────────────────────────────────────────────
interface Props {
  coreId: string
  coreType: CoreType
  binaries: string[]
  defaultValues: {
    binaryPath: string
    // Goose fields
    socksHost?: string
    socksPort?: number
    googleHost?: string
    sni?: string
    scriptKeys?: string[]
    tunnelKey?: string
    socksUser?: string
    socksPass?: string
    // FlowDriver fields
    listenAddr?: string
    googleFolderId?: string
    refreshRateMs?: number
    flushRateMs?: number
    transportTarget?: string
    transportSni?: string
    transportHost?: string
    credentialsPath?: string
  }
  onSaved?: () => void
}

export function ConfigForm({ coreId, coreType, binaries, defaultValues, onSaved }: Props) {
  if (coreType === 'flowdriver') {
    return (
      <FlowDriverConfigForm
        coreId={coreId}
        binaries={binaries}
        defaults={{
          binaryPath: defaultValues.binaryPath,
          listenAddr: defaultValues.listenAddr ?? '127.0.0.1:1080',
          googleFolderId: defaultValues.googleFolderId ?? '',
          refreshRateMs: defaultValues.refreshRateMs ?? 200,
          flushRateMs: defaultValues.flushRateMs ?? 300,
          transportTarget: defaultValues.transportTarget ?? '216.239.38.120:443',
          transportSni: defaultValues.transportSni ?? 'google.com',
          transportHost: defaultValues.transportHost ?? 'www.googleapis.com',
          credentialsPath: defaultValues.credentialsPath ?? '',
        }}
        onSaved={onSaved}
      />
    )
  }

  return (
    <GooseConfigForm
      coreId={coreId}
      binaries={binaries}
      defaults={{
        binaryPath: defaultValues.binaryPath,
        socksHost: defaultValues.socksHost ?? '127.0.0.1',
        socksPort: defaultValues.socksPort ?? 1080,
        googleHost: defaultValues.googleHost ?? '216.239.38.120',
        sniHosts: (() => {
          const raw = defaultValues.sni ?? 'www.google.com'
          try {
            const arr = JSON.parse(raw)
            if (Array.isArray(arr)) return arr.map((v: string) => ({ value: v }))
          } catch { }
          return [{ value: raw }]
        })(),
        scriptKeys: (defaultValues.scriptKeys ?? []).map((v) => typeof v === 'string' ? { value: v } : v),
        tunnelKey: defaultValues.tunnelKey ?? '',
        socksUser: defaultValues.socksUser ?? '',
        socksPass: defaultValues.socksPass ?? '',
      }}
      onSaved={onSaved}
    />
  )
}
