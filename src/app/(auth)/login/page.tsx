'use client'

import { useActionState } from 'react'
import { loginAction } from './actions'
import { Shield, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useState } from 'react'

export default function LoginPage() {
  const [state, action, isPending] = useActionState(loginAction, null)
  const [showPass, setShowPass] = useState(false)

  return (
    <div className="min-h-screen bg-bg-base bg-grid flex items-center justify-center p-4">
      {/* Background decorative scanlines */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(100,60,35,0.02) 3px, rgba(100,60,35,0.02) 4px)'}} />

      <div className="relative w-full max-w-sm">
        {/* Card */}
        <div className="glass corner-accent p-7">
          {/* Logo */}
          <div className="flex flex-col items-center mb-7">
            <div className="w-12 h-12 flex items-center justify-center mb-4" style={{border:'1px solid rgba(196,75,42,0.5)', background:'rgba(196,75,42,0.06)'}}>
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <p className="section-label mb-0.5">Secure Access</p>
            <h1 className="text-base font-bold neon-text tracking-widest uppercase">GGoose</h1>
            <p className="text-text-dim text-xs mt-1 tracking-widest uppercase" style={{fontSize:'0.55rem'}}>Management Console</p>
          </div>

          {/* Form */}
          <form action={action} className="space-y-4">
            {/* Error message */}
            {state?.error && (
              <div className="alert-banner px-3 py-2 text-danger text-xs text-center tracking-wider uppercase font-bold">
                {state.error}
              </div>
            )}

            {/* Username */}
            <div className="space-y-1">
              <label className="text-text-dim text-xs font-bold tracking-widest uppercase" style={{fontSize:'0.6rem'}} htmlFor="username">
                Identifier
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                disabled={isPending}
                className="w-full bg-bg-elevated border border-border hover:border-primary/40 focus:border-primary px-3 py-2.5 text-text-base text-xs font-mono tracking-wider transition-colors placeholder:text-text-dim disabled:opacity-50"
                placeholder="ENTER IDENTIFIER..."
              />
            </div>

            {/* Password */}
            <div className="space-y-1">
              <label className="text-text-dim text-xs font-bold tracking-widest uppercase" style={{fontSize:'0.6rem'}} htmlFor="password">
                Access Code
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  disabled={isPending}
                  className="w-full bg-bg-elevated border border-border hover:border-primary/40 focus:border-primary px-3 py-2.5 pr-10 text-text-base text-xs font-mono tracking-wider transition-colors placeholder:text-text-dim disabled:opacity-50"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-base transition-colors"
                >
                  {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isPending}
              className="w-full mt-5 bg-primary border border-primary/70 text-white font-bold tracking-widest uppercase text-xs py-2.5 transition-all btn-hover glow-primary disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Authenticating…
                </>
              ) : (
                'Authenticate'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-text-dim text-xs mt-6">
          GGoose UI · GooseRelayVPN Management
        </p>
      </div>
    </div>
  )
}
