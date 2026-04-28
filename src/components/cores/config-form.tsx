'use client'

import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const ConfigSchema = z.object({
  socksHost: z.string().min(1, 'Required'),
  socksPort: z.coerce.number().int().min(1).max(65535),
  googleHost: z.string().min(1, 'Required'),
  sni: z.string().min(1, 'Required'),
  scriptKeys: z.array(z.object({ value: z.string().min(1, 'Cannot be empty') })),
  tunnelKey: z.string().min(1, 'Required'),
  binaryPath: z.string().min(1, 'Required'),
})

type ConfigFormData = z.infer<typeof ConfigSchema>

interface Props {
  coreId: string
  binaries: string[]
  defaultValues: {
    socksHost: string
    socksPort: number
    googleHost: string
    sni: string
    scriptKeys: string[]
    tunnelKey: string
    binaryPath: string
  }
  onSaved?: () => void
}

function generateKey(): string {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function ConfigForm({ coreId, binaries, defaultValues, onSaved }: Props) {
  const [saving, setSaving] = useState(false)

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isDirty },
  } = useForm<ConfigFormData>({
    resolver: zodResolver(ConfigSchema),
    defaultValues: {
      ...defaultValues,
      scriptKeys: defaultValues.scriptKeys.map((v) => ({ value: v })),
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'scriptKeys' })

  async function onSubmit(data: ConfigFormData) {
    setSaving(true)
    try {
      const res = await fetch(`/api/cores/${coreId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          binaryPath: data.binaryPath,
          socksHost: data.socksHost,
          socksPort: data.socksPort,
          googleHost: data.googleHost,
          sni: data.sni,
          scriptKeys: data.scriptKeys.map((k) => k.value),
          tunnelKey: data.tunnelKey,
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
      {/* Binary */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold text-text-dim tracking-widest uppercase" style={{fontSize:'0.6rem'}}>Binary</label>
        <select
          {...register('binaryPath')}
          className="h-8 w-full border border-border bg-bg-elevated px-3 text-xs text-text-base focus:outline-none focus:border-primary transition-colors font-mono"
        >
          {binaries.length === 0 ? (
            <option value="">No binaries in data/cores/</option>
          ) : (
            binaries.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))
          )}
        </select>
        {errors.binaryPath && <p className="text-xs text-danger">{errors.binaryPath.message}</p>}
      </div>

      {/* Network */}
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="SOCKS Host"
          error={errors.socksHost?.message}
          {...register('socksHost')}
        />
        <Input
          label="SOCKS Port"
          type="number"
          error={errors.socksPort?.message}
          {...register('socksPort')}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Google Host (IP)"
          error={errors.googleHost?.message}
          {...register('googleHost')}
        />
        <Input
          label="SNI"
          error={errors.sni?.message}
          {...register('sni')}
        />
      </div>

      {/* Script Keys */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-text-dim tracking-widest uppercase" style={{fontSize:'0.6rem'}}>
            Script Keys ({fields.length})
          </label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => append({ value: '' })}
          >
            <Plus className="w-3 h-3" />
            Add key
          </Button>
        </div>
        {fields.length === 0 && (
          <p className="text-xs text-text-dim tracking-wider" style={{fontSize:'0.6rem', letterSpacing:'0.08em'}}>NO DEPLOYMENT IDs ADDED YET</p>
        )}
        <div className="space-y-2">
          {fields.map((field, i) => (
            <div key={field.id} className="flex gap-2 items-start">
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
                className="h-8 w-8 flex items-center justify-center text-text-muted hover:text-danger hover:bg-danger/10 transition-colors flex-shrink-0 border border-transparent hover:border-danger/30"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Tunnel Key */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-text-dim tracking-widest uppercase" style={{fontSize:'0.6rem'}}>Tunnel Key</label>
          <button
            type="button"
            className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors font-bold tracking-wider uppercase btn-hover"
            style={{fontSize:'0.6rem'}}
            onClick={() => setValue('tunnelKey', generateKey(), { shouldDirty: true })}
          >
            <RefreshCw className="w-2.5 h-2.5" />
            Generate
          </button>
        </div>
        <Input
          type="password"
          placeholder="64-char hex key"
          error={errors.tunnelKey?.message}
          {...register('tunnelKey')}
        />
        <p className="text-text-dim" style={{fontSize:'0.6rem', letterSpacing:'0.06em'}}>
          Must match the key on the VPS server. Never share.
        </p>
      </div>

      <Button type="submit" loading={saving} disabled={!isDirty}>
        Save changes
      </Button>
    </form>
  )
}
