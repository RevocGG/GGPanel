'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { X, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const CreateSchema = z.object({
  name: z.string().min(1, 'Required').max(64),
  description: z.string().max(256).optional(),
  binaryPath: z.string().min(1, 'Binary required'),
  socksHost: z.string().default('127.0.0.1'),
  socksPort: z.coerce.number().int().min(1).max(65535).default(1080),
  googleHost: z.string().default('216.239.38.120'),
  sni: z.string().default('www.google.com'),
  scriptKeys: z.array(z.object({ value: z.string().min(1) })).default([]),
  tunnelKey: z.string().default(''),
})

type CreateFormData = z.infer<typeof CreateSchema>

interface Props {
  binaries: string[]
  onClose: () => void
}

export function CreateCoreDialog({ binaries, onClose }: Props) {
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateFormData>({
    resolver: zodResolver(CreateSchema),
    defaultValues: {
      socksHost: '127.0.0.1',
      socksPort: 1080,
      googleHost: '216.239.38.120',
      sni: 'www.google.com',
      binaryPath: binaries[0] ?? '',
      scriptKeys: [],
      tunnelKey: '',
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'scriptKeys' })

  async function onSubmit(data: CreateFormData) {
    setSaving(true)
    try {
      const res = await fetch('/api/cores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          scriptKeys: data.scriptKeys.map((k) => k.value),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error('Create failed')
      toast.success(`Core "${data.name}" created`)
      router.refresh()
      onClose()
    } catch {
      toast.error('Failed to create core')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-bg-base/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative glass rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-base font-semibold text-text-base">Create Core</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-base hover:bg-bg-elevated transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          <Input label="Name" error={errors.name?.message} placeholder="e.g. Core 1" {...register('name')} />
          <Input label="Description (optional)" {...register('description')} />

          {/* Binary */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-muted">Binary</label>
            <select
              {...register('binaryPath')}
              className="h-9 w-full rounded-lg border border-border bg-bg-elevated px-3 text-sm text-text-base focus:outline-none focus:border-primary transition-colors"
            >
              {binaries.length === 0 ? (
                <option value="">Upload a binary to data/cores/ first</option>
              ) : binaries.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
            {errors.binaryPath && <p className="text-xs text-danger">{errors.binaryPath.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="SOCKS Host" {...register('socksHost')} />
            <Input label="SOCKS Port" type="number" {...register('socksPort')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Google Host" {...register('googleHost')} />
            <Input label="SNI" {...register('sni')} />
          </div>

          {/* Script keys */}
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
                  <Input placeholder="AKfycb..." {...register(`scriptKeys.${i}.value`)} />
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
          </div>

          <Input
            label="Tunnel Key"
            type="password"
            placeholder="Leave blank to set later"
            {...register('tunnelKey')}
          />

          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={saving}>Create Core</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
