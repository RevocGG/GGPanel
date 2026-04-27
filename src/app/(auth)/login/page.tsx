'use client'

import { useActionState } from 'react'
import { loginAction } from './actions'
import { Shield, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useState } from 'react'

export default function LoginPage() {
  const [state, action, isPending] = useActionState(loginAction, null)
  const [showPass, setShowPass] = useState(false)

  return (
    <div className="min-h-screen bg-bg-base bg-grid bg-radial-glow flex items-center justify-center p-4">
      {/* Background decorative orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-secondary/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="glass-elevated rounded-2xl p-8 glow-primary">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center mb-4 glow-primary">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold neon-text tracking-wider">GGoose</h1>
            <p className="text-text-muted text-sm mt-1">Management Console</p>
          </div>

          {/* Form */}
          <form action={action} className="space-y-4">
            {/* Error message */}
            {state?.error && (
              <div className="bg-danger/10 border border-danger/30 rounded-lg px-4 py-3 text-danger text-sm text-center">
                {state.error}
              </div>
            )}

            {/* Username */}
            <div className="space-y-1.5">
              <label className="text-text-muted text-xs font-medium uppercase tracking-wider" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                disabled={isPending}
                className="w-full bg-bg-surface/50 border border-border hover:border-border-hover focus:border-primary rounded-lg px-4 py-3 text-text-base text-sm transition-colors placeholder:text-text-muted disabled:opacity-50"
                placeholder="admin"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-text-muted text-xs font-medium uppercase tracking-wider" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  disabled={isPending}
                  className="w-full bg-bg-surface/50 border border-border hover:border-border-hover focus:border-primary rounded-lg px-4 py-3 pr-11 text-text-base text-sm transition-colors placeholder:text-text-muted disabled:opacity-50"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-base transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isPending}
              className="w-full mt-6 bg-primary hover:bg-primary/90 text-bg-base font-semibold rounded-lg py-3 text-sm transition-all duration-200 glow-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Authenticating…
                </>
              ) : (
                'Sign In'
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
